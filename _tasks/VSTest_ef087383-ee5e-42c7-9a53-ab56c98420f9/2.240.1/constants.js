"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgentVariables = exports.BackDoorVariables = exports.ActionOnThresholdNotMet = exports.ServerTypes = exports.DistributionTypes = exports.VsTestToolsInstaller = exports.ResultMessages = exports.AreaCodes = void 0;
var AreaCodes;
(function (AreaCodes) {
    AreaCodes.PUBLISHRESULTS = 'PublishResults';
    AreaCodes.INVOKEVSTEST = 'InvokeVsTest';
    AreaCodes.RUNTESTSLOCALLY = 'RunTestsLocally';
    AreaCodes.INVALIDSETTINGSFILE = 'InvalidSettingsFile';
    AreaCodes.EXECUTEVSTEST = 'ExecuteVsTest';
    AreaCodes.GETVSTESTTESTSLISTINTERNAL = 'GetVsTestTestsListInternal';
    AreaCodes.UPDATERESPONSEFILE = 'UpdateResponseFile';
    AreaCodes.RESPONSECONTAINSNOTESTS = 'ResponseContainsNoTests';
    AreaCodes.GENERATERESPONSEFILE = 'GenerateResponseFile';
    AreaCodes.GETVSTESTTESTSLIST = 'GetVsTestTestsList';
    AreaCodes.TIACONFIG = 'TiaConfig';
    AreaCodes.TESTRUNUPDATIONFAILED = 'TestRunUpdationFailed';
    AreaCodes.UPLOADTESTRESULTS = 'UploadTestResults';
    AreaCodes.RUNVSTEST = 'RunVsTest';
    AreaCodes.SPECIFIEDVSVERSIONNOTFOUND = 'SpecifiedVsVersionNotFound';
    AreaCodes.TOOLSINSTALLERCACHENOTFOUND = 'ToolsInstallerCacheNotFound';
})(AreaCodes || (exports.AreaCodes = AreaCodes = {}));
var ResultMessages;
(function (ResultMessages) {
    ResultMessages.UPLOADTESTRESULTSRETURNED = 'uploadTestResults returned ';
    ResultMessages.EXECUTEVSTESTRETURNED = 'executeVstest returned ';
    ResultMessages.TESTRUNUPDATIONFAILED = 'testRunupdation failed';
})(ResultMessages || (exports.ResultMessages = ResultMessages = {}));
var VsTestToolsInstaller;
(function (VsTestToolsInstaller) {
    VsTestToolsInstaller.PathToVsTestToolVariable = 'VsTestToolsInstallerInstalledToolLocation';
})(VsTestToolsInstaller || (exports.VsTestToolsInstaller = VsTestToolsInstaller = {}));
var DistributionTypes;
(function (DistributionTypes) {
    DistributionTypes.EXECUTIONTIMEBASED = 'TestExecutionTimes';
    DistributionTypes.ASSEMBLYBASED = 'TestAssemblies';
    DistributionTypes.NUMBEROFTESTMETHODSBASED = 'numberoftestmethods';
})(DistributionTypes || (exports.DistributionTypes = DistributionTypes = {}));
var ServerTypes;
(function (ServerTypes) {
    ServerTypes.HOSTED = 'hosted';
})(ServerTypes || (exports.ServerTypes = ServerTypes = {}));
var ActionOnThresholdNotMet;
(function (ActionOnThresholdNotMet) {
    ActionOnThresholdNotMet.DONOTHING = 'donothing';
})(ActionOnThresholdNotMet || (exports.ActionOnThresholdNotMet = ActionOnThresholdNotMet = {}));
var BackDoorVariables;
(function (BackDoorVariables) {
    BackDoorVariables.FORCE_HYDRA = 'Force_Hydra';
})(BackDoorVariables || (exports.BackDoorVariables = BackDoorVariables = {}));
var AgentVariables;
(function (AgentVariables) {
    AgentVariables.AGENT_TEMPDIRECTORY = 'Agent.TempDirectory';
})(AgentVariables || (exports.AgentVariables = AgentVariables = {}));
