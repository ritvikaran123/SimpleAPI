"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NonDistributedTest = void 0;
const tl = require("azure-pipelines-task-lib/task");
const path = require("path");
const utils = require("./helpers");
const ci = require("./cieventlogger");
const outStream = require("./outputstream");
const os = require("os");
const uuid = require("uuid");
const fs = require("fs");
const process = require("process");
class NonDistributedTest {
    constructor(inputDataContract) {
        this.sourceFilter = tl.getDelimitedInput('testAssemblyVer2', '\n', true);
        this.inputDataContract = inputDataContract;
    }
    runNonDistributedTest() {
        this.invokeDtaExecutionHost();
    }
    invokeDtaExecutionHost() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                console.log(tl.loc('runTestsLocally', 'vstest.console.exe'));
                console.log('========================================================');
                const exitCode = yield this.startDtaExecutionHost();
                tl.debug('DtaExecutionHost finished');
                if (exitCode !== 0 && !this.inputDataContract.TestReportingSettings.ExecutionStatusSettings.IgnoreTestFailures) {
                    tl.debug('Modules/DTAExecutionHost.exe process exited with code ' + exitCode);
                    tl.setResult(tl.TaskResult.Failed, tl.loc('VstestFailed'), true);
                    return;
                }
                else {
                    if (exitCode !== 0) {
                        console.log('Task marked as success because IgnoreTestFailures is enabled');
                    }
                    tl.debug(`Modules/DTAExecutionHost.exe exited with code ${exitCode}`);
                    tl.setResult(tl.TaskResult.Succeeded, 'Task succeeded', true);
                }
            }
            catch (err) {
                tl.setResult(tl.TaskResult.Failed, tl.loc('VstestFailedReturnCode'), true);
            }
        });
    }
    startDtaExecutionHost() {
        return __awaiter(this, void 0, void 0, function* () {
            let dtaExecutionHostTool = tl.tool(path.join(this.inputDataContract.VsTestConsolePath, 'vstest.console.exe'));
            this.inputDataContract.TestSelectionSettings.TestSourcesFile = this.createTestSourcesFile();
            tl.cd(this.inputDataContract.TfsSpecificSettings.WorkFolder);
            let envVars = process.env;
            dtaExecutionHostTool = tl.tool(path.join(__dirname, 'Modules/DTAExecutionHost.exe'));
            // Invoke DtaExecutionHost with the input json file
            const inputFilePath = utils.Helper.GenerateTempFile('input_' + uuid.v1() + '.json');
            utils.Helper.removeEmptyNodes(this.inputDataContract);
            try {
                fs.writeFileSync(inputFilePath, JSON.stringify(this.inputDataContract));
            }
            catch (e) {
                tl.setResult(tl.TaskResult.Failed, `Failed to write to the input json file ${inputFilePath} with error ${e}`);
            }
            dtaExecutionHostTool.arg(['--inputFile', inputFilePath]);
            utils.Helper.addToProcessEnvVars(envVars, 'DTA.AccessToken', tl.getEndpointAuthorization('SystemVssConnection', true).parameters.AccessToken);
            if (this.inputDataContract.ExecutionSettings.DiagnosticsSettings.Enabled) {
                utils.Helper.addToProcessEnvVars(envVars, 'PROCDUMP_PATH', path.join(__dirname, 'ProcDump'));
            }
            // hydra: See which of these are required in C# layer. Do we want this for telemetry??
            // utils.Helper.addToProcessEnvVars(envVars, 'DTA.AgentVersion', tl.getVariable('AGENT.VERSION'));
            if (this.inputDataContract.UsingXCopyTestPlatformPackage) {
                envVars = utils.Helper.setProfilerVariables(envVars);
            }
            const execOptions = {
                IgnoreTestFailures: this.inputDataContract.TestReportingSettings.ExecutionStatusSettings.IgnoreTestFailures,
                env: envVars,
                failOnStdErr: false,
                // In effect this will not be called as failOnStdErr is false
                // Keeping this code in case we want to change failOnStdErr
                errStream: new outStream.StringErrorWritable({ decodeStrings: false })
            };
            // The error codes return below are not the same as tl.TaskResult which follows a different convention.
            // Here we are returning the code as returned to us by vstest.console in case of complete run
            // In case of a failure 1 indicates error to our calling function
            try {
                return yield dtaExecutionHostTool.exec(execOptions);
            }
            catch (err) {
                tl.warning(tl.loc('VstestFailed'));
                tl.error(err);
                return 1;
            }
        });
    }
    createTestSourcesFile() {
        try {
            console.log(tl.loc('UserProvidedSourceFilter', this.sourceFilter.toString()));
            const telemetryProps = { MiniMatchLines: this.sourceFilter.length };
            telemetryProps.ExecutionFlow = 'NonDistributed';
            const start = new Date().getTime();
            const sources = tl.findMatch(this.inputDataContract.TestSelectionSettings.SearchFolder, this.sourceFilter);
            const timeTaken = new Date().getTime() - start;
            tl.debug(`Time taken for applying the minimatch pattern to filter out the sources ${timeTaken} ms`);
            telemetryProps.TimeToSearchDLLsInMilliSeconds = timeTaken;
            tl.debug(`${sources.length} files matched the given minimatch filter`);
            ci.publishTelemetry('TestExecution', 'MinimatchFilterPerformance', telemetryProps);
            const filesMatching = [];
            sources.forEach(function (match) {
                if (!fs.lstatSync(match).isDirectory()) {
                    filesMatching.push(match);
                }
            });
            tl.debug('Files matching count :' + filesMatching.length);
            if (filesMatching.length === 0) {
                tl.warning(tl.loc('noTestSourcesFound', this.sourceFilter.toString()));
                if (this.inputDataContract.TestReportingSettings.ExecutionStatusSettings.ActionOnThresholdNotMet.toLowerCase() === 'fail') {
                    throw new Error(tl.loc('minTestsNotExecuted', this.inputDataContract.TestReportingSettings.ExecutionStatusSettings.MinimumExecutedTestsExpected));
                }
                else {
                    tl.setResult(tl.TaskResult.Succeeded, tl.loc('noTestSourcesFound', this.sourceFilter.toString()), true);
                    process.exit(0);
                }
            }
            const tempFile = utils.Helper.GenerateTempFile('testSources_' + uuid.v1() + '.src');
            fs.writeFileSync(tempFile, filesMatching.join(os.EOL));
            tl.debug('Test Sources file :' + tempFile);
            return tempFile;
        }
        catch (error) {
            throw new Error(tl.loc('testSourcesFilteringFailed', error));
        }
    }
}
exports.NonDistributedTest = NonDistributedTest;
