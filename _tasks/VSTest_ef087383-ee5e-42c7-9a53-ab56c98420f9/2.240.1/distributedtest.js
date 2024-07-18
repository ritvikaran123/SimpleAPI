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
exports.DistributedTest = void 0;
const fs = require("fs");
const path = require("path");
const tl = require("azure-pipelines-task-lib/task");
const utils = require("./helpers");
const os = require("os");
const ci = require("./cieventlogger");
const testselectorinvoker_1 = require("./testselectorinvoker");
const fs_1 = require("fs");
const uuid = require("uuid");
const testSelector = new testselectorinvoker_1.TestSelectorInvoker();
class DistributedTest {
    constructor(inputDataContract) {
        this.dtaPid = -1;
        this.inputDataContract = inputDataContract;
    }
    runDistributedTest() {
        this.invokeDtaExecutionHost();
    }
    invokeDtaExecutionHost() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const exitCode = yield this.startDtaExecutionHost();
                tl.debug('DtaExecutionHost finished');
                if (exitCode !== 0) {
                    tl.debug('Modules/DTAExecutionHost.exe process exited with code ' + exitCode);
                    tl.setResult(tl.TaskResult.Failed, 'Modules/DTAExecutionHost.exe process exited with code ' + exitCode, true);
                }
                else {
                    tl.debug('Modules/DTAExecutionHost.exe exited');
                    tl.setResult(tl.TaskResult.Succeeded, 'Task succeeded', true);
                }
            }
            catch (error) {
                ci.publishEvent({ environmenturi: this.inputDataContract.RunIdentifier, error: error });
                tl.setResult(tl.TaskResult.Failed, error, true);
            }
        });
    }
    startDtaExecutionHost() {
        return __awaiter(this, void 0, void 0, function* () {
            let envVars = process.env;
            // Overriding temp with agent temp
            utils.Helper.addToProcessEnvVars(envVars, 'temp', utils.Helper.GetTempFolder());
            this.inputDataContract.TestSelectionSettings.TestSourcesFile = this.createTestSourcesFile();
            // Temporary solution till this logic can move to the test platform itself
            if (this.inputDataContract.UsingXCopyTestPlatformPackage) {
                envVars = utils.Helper.setProfilerVariables(envVars);
            }
            // Pass the acess token as an environment variable for security purposes
            utils.Helper.addToProcessEnvVars(envVars, 'DTA.AccessToken', tl.getEndpointAuthorization('SystemVssConnection', true).parameters.AccessToken);
            if (this.inputDataContract.ExecutionSettings.DiagnosticsSettings.Enabled) {
                utils.Helper.addToProcessEnvVars(envVars, 'PROCDUMP_PATH', path.join(__dirname, 'ProcDump'));
            }
            // Invoke DtaExecutionHost with the input json file
            const inputFilePath = utils.Helper.GenerateTempFile('input_' + uuid.v1() + '.json');
            utils.Helper.removeEmptyNodes(this.inputDataContract);
            try {
                (0, fs_1.writeFileSync)(inputFilePath, JSON.stringify(this.inputDataContract));
            }
            catch (e) {
                tl.setResult(tl.TaskResult.Failed, `Failed to write to the input json file ${inputFilePath} with error ${e}`);
            }
            const dtaExecutionHostTool = tl.tool(path.join(__dirname, 'Modules/DTAExecutionHost.exe'));
            dtaExecutionHostTool.arg(['--inputFile', inputFilePath]);
            const code = yield dtaExecutionHostTool.exec({ ignoreReturnCode: this.inputDataContract.TestReportingSettings.ExecutionStatusSettings.IgnoreTestFailures, env: envVars });
            //hydra: add consolidated ci for inputs in C# layer for now
            const consolidatedCiData = {
                agentFailure: false
            };
            if (code !== 0) {
                consolidatedCiData.agentFailure = true;
            }
            else {
                tl.debug('Modules/DTAExecutionHost.exe exited');
            }
            ci.publishEvent(consolidatedCiData);
            return code;
        });
    }
    createTestSourcesFile() {
        try {
            let sourceFilter = tl.getDelimitedInput('testAssemblyVer2', '\n', true);
            console.log(tl.loc('UserProvidedSourceFilter', sourceFilter.toString()));
            if (this.inputDataContract.TestSelectionSettings.TestSelectionType.toLowerCase() !== 'testassemblies') {
                sourceFilter = ['**\\*', '!**\\obj\\**'];
            }
            const telemetryProps = { MiniMatchLines: sourceFilter.length };
            telemetryProps.ExecutionFlow = 'Distributed';
            const start = new Date().getTime();
            const sources = tl.findMatch(this.inputDataContract.TestSelectionSettings.SearchFolder, sourceFilter);
            tl.debug(`${sources.length} files matched the given minimatch filter`);
            const timeTaken = new Date().getTime() - start;
            tl.debug(`Time taken for applying the minimatch pattern to filter out the sources ${timeTaken} ms`);
            telemetryProps.TimeToSearchDLLsInMilliSeconds = timeTaken;
            ci.publishTelemetry('TestExecution', 'MinimatchFilterPerformance', telemetryProps);
            const filesMatching = [];
            sources.forEach(function (match) {
                if (!fs.lstatSync(match).isDirectory()) {
                    filesMatching.push(match);
                }
            });
            tl.debug('Files matching count :' + filesMatching.length);
            if (filesMatching.length === 0) {
                tl.warning(tl.loc('noTestSourcesFound', sourceFilter.toString()));
                if (this.inputDataContract.TestReportingSettings.ExecutionStatusSettings.ActionOnThresholdNotMet.toLowerCase() === 'fail') {
                    throw new Error(tl.loc('minTestsNotExecuted', this.inputDataContract.TestReportingSettings.ExecutionStatusSettings.MinimumExecutedTestsExpected));
                }
                else {
                    tl.setResult(tl.TaskResult.Succeeded, tl.loc('noTestSourcesFound', sourceFilter.toString()), true);
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
exports.DistributedTest = DistributedTest;
