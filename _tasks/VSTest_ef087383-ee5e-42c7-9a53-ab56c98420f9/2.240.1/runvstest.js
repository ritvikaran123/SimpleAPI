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
const tl = require("azure-pipelines-task-lib/task");
const nondistributedtest = require("./nondistributedtest");
const path = require("path");
const distributedTest = require("./distributedtest");
const ci = require("./cieventlogger");
const utils = require("./helpers");
const inputParser = require("./inputparser");
const os = require("os");
const localtest = require("./vstest");
const constants_1 = require("./constants");
const request = require('request');
const osPlat = os.platform();
tl.setResourcePath(path.join(__dirname, 'task.json'));
function execute() {
    return __awaiter(this, void 0, void 0, function* () {
        const taskProps = { state: 'started' };
        ci.publishEvent(taskProps);
        const enableApiExecution = yield isFeatureFlagEnabled(tl.getVariable('System.TeamFoundationCollectionUri'), 'TestExecution.EnableTranslationApi', tl.getEndpointAuthorization('SystemVssConnection', true).parameters.AccessToken);
        try {
            utils.Helper.setConsoleCodePage();
            const blockRun = isMultiConfigOnDemandRun();
            if (blockRun) {
                tl.setResult(tl.TaskResult.Failed, tl.loc('MultiConfigNotSupportedWithOnDemand'));
            }
            const serverBasedRun = isServerBasedRun();
            inputParser.setIsServerBasedRun(serverBasedRun);
            const enableDiagnostics = yield isFeatureFlagEnabled(tl.getVariable('System.TeamFoundationCollectionUri'), 'TestExecution.EnableDiagnostics', tl.getEndpointAuthorization('SystemVssConnection', true).parameters.AccessToken);
            inputParser.setEnableDiagnosticsSettings(enableDiagnostics);
            if (serverBasedRun) {
                ci.publishEvent({
                    runmode: 'distributedtest', parallelism: tl.getVariable('System.ParallelExecutionType'),
                    testtype: tl.getInput('testSelector')
                });
                console.log(tl.loc('distributedTestWorkflow'));
                console.log('======================================================');
                const inputDataContract = inputParser.parseInputsForDistributedTestRun();
                console.log('======================================================');
                const test = new distributedTest.DistributedTest(inputDataContract);
                test.runDistributedTest();
            }
            else {
                ci.publishEvent({ runmode: 'nondistributed' });
                console.log(tl.loc('nonDistributedTestWorkflow'));
                console.log('======================================================');
                const inputDataContract = inputParser.parseInputsForNonDistributedTestRun();
                const enableHydra = isHydraFlowToBeEnabled(inputDataContract);
                if (enableHydra || inputDataContract.EnableSingleAgentAPIFlow || (inputDataContract.ExecutionSettings
                    && inputDataContract.ExecutionSettings.RerunSettings
                    && inputDataContract.ExecutionSettings.RerunSettings.RerunFailedTests)) {
                    if (enableApiExecution) {
                        console.log('================== API Execution =====================');
                        inputDataContract.ExecutionSettings.TestPlatformExecutionMode = 'api';
                    }
                    const test = new nondistributedtest.NonDistributedTest(inputDataContract);
                    test.runNonDistributedTest();
                }
                else {
                    localtest.startTest();
                }
                console.log('======================================================');
            }
        }
        catch (error) {
            tl.setResult(tl.TaskResult.Failed, error);
            taskProps.result = error.message;
        }
        finally {
            taskProps.state = 'completed';
            ci.publishEvent(taskProps);
        }
    });
}
function isHydraFlowToBeEnabled(inputDataContract) {
    try {
        if ((inputDataContract.ServerType && inputDataContract.ServerType.toLowerCase() === constants_1.ServerTypes.HOSTED)) {
            tl.debug('Enabling Hydra flow since serverType is hosted.');
            return true;
        }
        if (tl.getVariable(constants_1.BackDoorVariables.FORCE_HYDRA) && tl.getVariable(constants_1.BackDoorVariables.FORCE_HYDRA).toLowerCase() === 'true') {
            tl.debug(`Enabling Hydra flow since ${constants_1.BackDoorVariables.FORCE_HYDRA} build variable is set to true.`);
            return true;
        }
        if (inputDataContract.TestReportingSettings && inputDataContract.TestReportingSettings.ExecutionStatusSettings
            && !utils.Helper.isNullEmptyOrUndefined(inputDataContract.TestReportingSettings.ExecutionStatusSettings.ActionOnThresholdNotMet)
            && inputDataContract.TestReportingSettings.ExecutionStatusSettings.ActionOnThresholdNotMet !== constants_1.ActionOnThresholdNotMet.DONOTHING) {
            tl.debug('Enabling Hydra flow since the minimum test executed feature is being used.');
            return true;
        }
        if (inputDataContract.TestReportingSettings
            && !utils.Helper.isNullEmptyOrUndefined(inputDataContract.TestReportingSettings.TestResultsDirectory)
            && inputDataContract.TestReportingSettings.TestResultsDirectory.toLowerCase()
                !== path.join(tl.getVariable(constants_1.AgentVariables.AGENT_TEMPDIRECTORY), 'TestResults').toLowerCase()) {
            tl.debug('Enabling Hydra flow since the override results directory feature is being used.');
            return true;
        }
    }
    catch (e) {
        tl.debug(`Unexpected error occurred while trying to check if hydra flow is enabled ${e}`);
        ci.publishEvent({ 'FailedToCheckIfHydraEnabled': 'true', 'Exception': e });
    }
    return false;
}
function isFeatureFlagEnabled(collectionUri, featureFlag, token) {
    let state = false;
    const options = {
        url: collectionUri + '/_apis/FeatureFlags/' + featureFlag,
        json: true,
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + token
        }
    };
    return new Promise((resolve, reject) => {
        request(options, (err, res, faModel) => {
            if (err) {
                tl.warning(tl.loc('UnableToGetFeatureFlag', featureFlag));
                tl.debug('Unable to get feature flag ' + featureFlag + ' Error:' + err.message);
                resolve(state);
            }
            if (faModel && faModel.effectiveState) {
                state = ('on' === faModel.effectiveState.toLowerCase());
                tl.debug(' Final feature flag state: ' + state);
            }
            resolve(state);
        });
    });
}
function isMultiConfigOnDemandRun() {
    const testType = tl.getInput('testSelector');
    const parallelExecution = tl.getVariable('System.ParallelExecutionType');
    if (testType && testType.toLowerCase() === 'testrun' && parallelExecution && parallelExecution.toLowerCase() === 'multiconfiguration') {
        return true;
    }
    return false;
}
function isServerBasedRun() {
    const batchType = tl.getInput('distributionBatchType');
    if (batchType && batchType === 'basedOnTestCases') {
        const batchSize = tl.getInput('batchingBasedOnAgentsOption');
        if (batchSize && batchSize === 'customBatchSize') {
            return true;
        }
    }
    else if (batchType && batchType === 'basedOnExecutionTime') {
        return true;
    }
    else if (batchType && batchType === 'basedOnAssembly') {
        return true;
    }
    const testType = tl.getInput('testSelector');
    tl.debug('Value of Test Selector :' + testType);
    if (testType.toLowerCase() === 'testplan' || testType.toLowerCase() === 'testrun') {
        return true;
    }
    const parallelExecution = tl.getVariable('System.ParallelExecutionType');
    tl.debug('Value of ParallelExecutionType :' + parallelExecution);
    if (parallelExecution && parallelExecution.toLowerCase() === 'multimachine') {
        const dontDistribute = tl.getBoolInput('dontDistribute');
        if (dontDistribute) {
            return false;
        }
        return true;
    }
    return false;
}
if (osPlat !== 'win32') {
    // Fail the task if os is not windows
    tl.setResult(tl.TaskResult.Failed, tl.loc('OnlyWindowsOsSupported'));
}
else {
    //Starting the VsTest execution
    execute();
}
