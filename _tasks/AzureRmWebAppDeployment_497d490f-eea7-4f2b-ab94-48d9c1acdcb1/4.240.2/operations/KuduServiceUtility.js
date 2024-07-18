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
exports.KuduServiceUtility = void 0;
const tl = require("azure-pipelines-task-lib/task");
const path = require("path");
const TaskParameters_1 = require("./TaskParameters");
const Constants_1 = require("./Constants");
const constants_1 = require("azure-pipelines-tasks-azure-arm-rest/constants");
const webClient = require("azure-pipelines-tasks-azure-arm-rest/webClient");
var deployUtility = require('azure-pipelines-tasks-webdeployment-common/utility.js');
var zipUtility = require('azure-pipelines-tasks-webdeployment-common/ziputility.js');
const physicalRootPath = '/site/wwwroot';
const deploymentFolder = 'site/deployments';
const manifestFileName = 'manifest';
const VSTS_ZIP_DEPLOY = 'VSTS_ZIP_DEPLOY';
const VSTS_DEPLOY = 'VSTS';
class KuduServiceUtility {
    constructor(kuduService) {
        this._appServiceKuduService = kuduService;
    }
    createPathIfRequired(phsyicalPath) {
        return __awaiter(this, void 0, void 0, function* () {
            var listDir = yield this._appServiceKuduService.listDir(phsyicalPath);
            if (listDir == null) {
                yield this._appServiceKuduService.createPath(phsyicalPath);
            }
        });
    }
    updateDeploymentStatus(taskResult, DeploymentID, customMessage) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                let requestBody = this._getUpdateHistoryRequest(taskResult, DeploymentID, customMessage);
                return yield this._appServiceKuduService.updateDeployment(requestBody);
            }
            catch (error) {
                tl.warning(error);
            }
        });
    }
    runPostDeploymentScript(taskParams, directoryPath) {
        return __awaiter(this, void 0, void 0, function* () {
            var uniqueID = this.getDeploymentID();
            let vstsPostDeploymentFolderPath = path.join(physicalRootPath.substring(1), '..', 'VSTS_PostDeployment_' + uniqueID);
            try {
                var rootDirectoryPath = directoryPath || physicalRootPath.substring(1);
                if (taskParams.TakeAppOfflineFlag) {
                    yield this._appOfflineKuduService(rootDirectoryPath, true);
                }
                var scriptFile = this._getPostDeploymentScript(taskParams.ScriptType, taskParams.InlineScript, taskParams.ScriptPath, taskParams.isLinuxApp);
                var fileExtension = taskParams.isLinuxApp ? '.sh' : '.cmd';
                var mainCmdFilePath = path.join(__dirname, '..', 'postDeploymentScript', 'mainCmdFile' + fileExtension);
                yield this._appServiceKuduService.uploadFile(vstsPostDeploymentFolderPath, 'mainCmdFile' + fileExtension, mainCmdFilePath);
                yield this._appServiceKuduService.uploadFile(vstsPostDeploymentFolderPath, 'kuduPostDeploymentScript' + fileExtension, scriptFile.filePath);
                console.log(tl.loc('ExecuteScriptOnKudu'));
                var cmdFilePath = '%Home%\\site\\VSTS_PostDeployment_' + uniqueID + '\\mainCmdFile' + fileExtension;
                var scriprResultPath = '/site/VSTS_PostDeployment_' + uniqueID;
                if (taskParams.isLinuxApp) {
                    cmdFilePath = '/home/site/VSTS_PostDeployment_' + uniqueID + '/mainCmdFile' + fileExtension;
                }
                yield this.runCommand(rootDirectoryPath, cmdFilePath + ' ' + uniqueID, 30, scriprResultPath, 'script_result.txt');
                yield this._printPostDeploymentLogs(vstsPostDeploymentFolderPath);
            }
            catch (error) {
                if (taskParams.UseWebDeploy && taskParams.DeploymentType === TaskParameters_1.DeploymentType.runFromZip) {
                    var debugMode = tl.getVariable('system.debug');
                    if (debugMode && debugMode.toLowerCase() == 'true') {
                        tl.warning(tl.loc('Publishusingrunfromzipwithpostdeploymentscript'));
                    }
                    else {
                        console.log(tl.loc('Publishusingrunfromzipwithpostdeploymentscript'));
                    }
                }
                throw Error(tl.loc('FailedToRunScriptOnKuduError', error));
            }
            finally {
                try {
                    let deleteFilePath = '%Home%\\site\\VSTS_PostDeployment_' + uniqueID + '\\delete_log_file' + fileExtension;
                    if (taskParams.isLinuxApp) {
                        deleteFilePath = '/home/site/VSTS_PostDeployment_' + uniqueID + '/delete_log_file' + fileExtension;
                    }
                    yield this._appServiceKuduService.uploadFile(vstsPostDeploymentFolderPath, 'delete_log_file' + fileExtension, path.join(__dirname, '..', 'postDeploymentScript', 'deleteLogFile' + fileExtension));
                    yield this.runCommand(vstsPostDeploymentFolderPath, deleteFilePath);
                    yield this._appServiceKuduService.deleteFolder(vstsPostDeploymentFolderPath);
                }
                catch (error) {
                    tl.debug('Unable to delete log files : ' + error);
                }
                if (taskParams.TakeAppOfflineFlag) {
                    yield this._appOfflineKuduService(rootDirectoryPath, false);
                }
            }
        });
    }
    getDeploymentID() {
        if (this._deploymentID) {
            return this._deploymentID;
        }
        var buildUrl = tl.getVariable('build.buildUri');
        var releaseUrl = tl.getVariable('release.releaseUri');
        var buildId = tl.getVariable('build.buildId');
        var releaseId = tl.getVariable('release.releaseId');
        var buildNumber = tl.getVariable('build.buildNumber');
        var releaseName = tl.getVariable('release.releaseName');
        var collectionUrl = tl.getVariable('system.TeamFoundationCollectionUri');
        var teamProject = tl.getVariable('system.teamProjectId');
        var commitId = tl.getVariable('build.sourceVersion');
        var repoName = tl.getVariable('build.repository.name');
        var repoProvider = tl.getVariable('build.repository.provider');
        var buildOrReleaseUrl = "";
        var deploymentID = (releaseId ? releaseId : buildId) + Date.now().toString();
        return deploymentID;
    }
    deployWebPackage(packagePath, physicalPath, virtualPath, appOffline) {
        return __awaiter(this, void 0, void 0, function* () {
            physicalPath = physicalPath ? physicalPath : physicalRootPath;
            try {
                if (appOffline) {
                    yield this._appOfflineKuduService(physicalPath, true);
                    tl.debug('Wait for 5 seconds for app_offline to take effect');
                    yield webClient.sleepFor(5);
                }
                if (tl.stats(packagePath).isDirectory()) {
                    let tempPackagePath = deployUtility.generateTemporaryFolderOrZipPath(tl.getVariable('AGENT.TEMPDIRECTORY'), false);
                    packagePath = yield zipUtility.archiveFolder(packagePath, "", tempPackagePath);
                    tl.debug("Compressed folder " + packagePath + " into zip : " + packagePath);
                }
                else if (packagePath.toLowerCase().endsWith('.war')) {
                    physicalPath = yield this._warFileDeployment(packagePath, physicalPath, virtualPath);
                }
                yield this._appServiceKuduService.extractZIP(packagePath, physicalPath);
                if (appOffline) {
                    yield this._appOfflineKuduService(physicalPath, false);
                }
                console.log(tl.loc("Successfullydeployedpackageusingkuduserviceat", packagePath, physicalPath));
            }
            catch (error) {
                tl.error(tl.loc('PackageDeploymentFailed'));
                throw Error(error);
            }
        });
    }
    deployUsingZipDeploy(packagePath, appOffline, customMessage) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                console.log(tl.loc('PackageDeploymentInitiated'));
                if (appOffline) {
                    yield this._appOfflineKuduService(physicalRootPath, true);
                    tl.debug('Wait for 5 seconds for app_offline to take effect');
                    yield webClient.sleepFor(5);
                }
                let queryParameters = [
                    'isAsync=true',
                    'deployer=' + VSTS_ZIP_DEPLOY
                ];
                var deploymentMessage = this._getUpdateHistoryRequest(true, null, customMessage).message;
                queryParameters.push('message=' + encodeURIComponent(deploymentMessage));
                let deploymentDetails = yield this._appServiceKuduService.zipDeploy(packagePath, queryParameters);
                yield this._processDeploymentResponse(deploymentDetails);
                if (appOffline) {
                    yield this._appOfflineKuduService(physicalRootPath, false);
                }
                console.log(tl.loc('PackageDeploymentSuccess'));
                return deploymentDetails.id;
            }
            catch (error) {
                tl.error(tl.loc('PackageDeploymentFailed'));
                throw Error(error);
            }
        });
    }
    deployUsingRunFromZip(packagePath, customMessage) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                console.log(tl.loc('PackageDeploymentInitiated'));
                let queryParameters = [
                    'deployer=' + VSTS_DEPLOY
                ];
                var deploymentMessage = this._getUpdateHistoryRequest(true, null, customMessage).message;
                queryParameters.push('message=' + encodeURIComponent(deploymentMessage));
                yield this._appServiceKuduService.zipDeploy(packagePath, queryParameters);
                console.log(tl.loc('PackageDeploymentSuccess'));
                console.log("NOTE: Run From Package makes wwwroot read-only, so you will receive an error when writing files to this directory.");
            }
            catch (error) {
                tl.error(tl.loc('PackageDeploymentFailed'));
                throw Error(error);
            }
        });
    }
    deployUsingWarDeploy(packagePath, customMessage, targetFolderName) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                console.log(tl.loc('WarPackageDeploymentInitiated'));
                let queryParameters = [
                    'isAsync=true'
                ];
                if (targetFolderName) {
                    queryParameters.push('name=' + encodeURIComponent(targetFolderName));
                }
                var deploymentMessage = this._getUpdateHistoryRequest(true, null, customMessage).message;
                queryParameters.push('message=' + encodeURIComponent(deploymentMessage));
                let deploymentDetails = yield this._appServiceKuduService.warDeploy(packagePath, queryParameters);
                yield this._processDeploymentResponse(deploymentDetails);
                console.log(tl.loc('PackageDeploymentSuccess'));
                return deploymentDetails.id;
            }
            catch (error) {
                tl.error(tl.loc('PackageDeploymentFailed'));
                throw Error(error);
            }
        });
    }
    postZipDeployOperation(oldDeploymentID, activeDeploymentID) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                tl.debug(`ZIP DEPLOY - Performing post zip-deploy operation: ${oldDeploymentID} => ${activeDeploymentID}`);
                let manifestFileContent = yield this._appServiceKuduService.getFileContent(`${deploymentFolder}/${oldDeploymentID}`, manifestFileName);
                if (!!manifestFileContent) {
                    let tempManifestFile = path.join(tl.getVariable('AGENT.TEMPDIRECTORY'), manifestFileName);
                    tl.writeFile(tempManifestFile, manifestFileContent);
                    yield this._appServiceKuduService.uploadFile(`${deploymentFolder}/${activeDeploymentID}`, manifestFileName, tempManifestFile);
                }
                tl.debug('ZIP DEPLOY - Performed post-zipdeploy operation.');
            }
            catch (error) {
                tl.debug(`Failed to execute post zip-deploy operation: ${JSON.stringify(error)}.`);
            }
        });
    }
    warmpUp() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                tl.debug('warming up Kudu Service');
                yield this._appServiceKuduService.getAppSettings();
                tl.debug('warmed up Kudu Service');
            }
            catch (error) {
                tl.debug('Failed to warm-up Kudu: ' + error.toString());
            }
        });
    }
    _processDeploymentResponse(deploymentDetails) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                var kuduDeploymentDetails = yield this._appServiceKuduService.getDeploymentDetails(deploymentDetails.id);
                tl.debug(`logs from kudu deploy: ${kuduDeploymentDetails.log_url}`);
                if (deploymentDetails.status == constants_1.KUDU_DEPLOYMENT_CONSTANTS.FAILED || tl.getVariable('system.debug') && tl.getVariable('system.debug').toLowerCase() == 'true') {
                    yield this._printZipDeployLogs(kuduDeploymentDetails.log_url);
                }
                else {
                    console.log(tl.loc('DeployLogsURL', kuduDeploymentDetails.log_url));
                }
            }
            catch (error) {
                tl.debug(`Unable to fetch logs for kudu Deploy: ${JSON.stringify(error)}`);
            }
            if (deploymentDetails.status == constants_1.KUDU_DEPLOYMENT_CONSTANTS.FAILED) {
                throw tl.loc('PackageDeploymentUsingZipDeployFailed');
            }
        });
    }
    _printZipDeployLogs(log_url) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!log_url) {
                return;
            }
            var deploymentLogs = yield this._appServiceKuduService.getDeploymentLogs(log_url);
            for (var deploymentLog of deploymentLogs) {
                console.log(`${deploymentLog.message}`);
                if (deploymentLog.details_url) {
                    yield this._printZipDeployLogs(deploymentLog.details_url);
                }
            }
        });
    }
    _printPostDeploymentLogs(physicalPath) {
        return __awaiter(this, void 0, void 0, function* () {
            var stdoutLog = yield this._appServiceKuduService.getFileContent(physicalPath, 'stdout.txt');
            var stderrLog = yield this._appServiceKuduService.getFileContent(physicalPath, 'stderr.txt');
            var scriptReturnCode = yield this._appServiceKuduService.getFileContent(physicalPath, 'script_result.txt');
            if (scriptReturnCode == null) {
                throw new Error('File not found in Kudu Service. ' + 'script_result.txt');
            }
            if (stdoutLog) {
                console.log(tl.loc('stdoutFromScript'));
                console.log(stdoutLog);
            }
            if (stderrLog) {
                console.log(tl.loc('stderrFromScript'));
                if (scriptReturnCode != '0') {
                    tl.error(stderrLog);
                    throw Error(tl.loc('ScriptExecutionOnKuduFailed', scriptReturnCode, stderrLog));
                }
                else {
                    console.log(stderrLog);
                }
            }
        });
    }
    runCommand(physicalPath, command, timeOutInMinutes, pollFolderPath, pollFile) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield this._appServiceKuduService.runCommand(physicalPath, command);
            }
            catch (error) {
                if (!!pollFolderPath && !!pollFile && timeOutInMinutes > 0 && error.toString().indexOf('Request timeout: /api/command') != -1) {
                    tl.debug('Request timeout occurs. Trying to poll for file: ' + pollFile);
                    yield this._pollForFile(pollFolderPath, pollFile, timeOutInMinutes);
                }
                else {
                    if (typeof error.valueOf() == 'string') {
                        throw error;
                    }
                    throw `${error.statusCode} - ${error.statusMessage}`;
                }
            }
        });
    }
    _getPostDeploymentScript(scriptType, inlineScript, scriptPath, isLinux) {
        if (scriptType === 'Inline Script') {
            tl.debug('creating kuduPostDeploymentScript_local file');
            var scriptFilePath = path.join(tl.getVariable('AGENT.TEMPDIRECTORY'), isLinux ? 'kuduPostDeploymentScript_local.sh' : 'kuduPostDeploymentScript_local.cmd');
            tl.writeFile(scriptFilePath, inlineScript);
            tl.debug('Created temporary script file : ' + scriptFilePath);
            return {
                "filePath": scriptFilePath,
                "isCreated": true
            };
        }
        if (!tl.exist(scriptPath)) {
            throw Error(tl.loc('ScriptFileNotFound', scriptPath));
        }
        var scriptExtension = path.extname(scriptPath);
        if (isLinux) {
            if (scriptExtension != '.sh') {
                throw Error(tl.loc('InvalidScriptFile', scriptPath));
            }
        }
        else {
            if (scriptExtension != '.bat' && scriptExtension != '.cmd') {
                throw Error(tl.loc('InvalidScriptFile', scriptPath));
            }
        }
        tl.debug('postDeployment script path to execute : ' + scriptPath);
        return {
            filePath: scriptPath,
            isCreated: false
        };
    }
    _warFileDeployment(packagePath, physicalPath, virtualPath) {
        return __awaiter(this, void 0, void 0, function* () {
            tl.debug('WAR: webAppPackage = ' + packagePath);
            let warFile = path.basename(packagePath.slice(0, packagePath.length - '.war'.length));
            let warExt = packagePath.slice(packagePath.length - '.war'.length);
            tl.debug('WAR: warFile = ' + warFile);
            warFile = warFile + ((virtualPath) ? "/" + virtualPath : "");
            tl.debug('WAR: warFile = ' + warFile);
            physicalPath = physicalPath + "/webapps/" + warFile;
            yield this.createPathIfRequired(physicalPath);
            return physicalPath;
        });
    }
    _appOfflineKuduService(physicalPath, enableFeature) {
        return __awaiter(this, void 0, void 0, function* () {
            if (enableFeature) {
                tl.debug('Trying to enable app offline mode.');
                var appOfflineFilePath = path.join(tl.getVariable('AGENT.TEMPDIRECTORY'), 'app_offline_temp.htm');
                tl.writeFile(appOfflineFilePath, '<h1>App Service is offline.</h1>');
                yield this._appServiceKuduService.uploadFile(physicalPath, 'app_offline.htm', appOfflineFilePath);
                tl.debug('App Offline mode enabled.');
            }
            else {
                tl.debug('Trying to disable app offline mode.');
                yield this._appServiceKuduService.deleteFile(physicalPath, 'app_offline.htm');
                tl.debug('App Offline mode disabled.');
            }
        });
    }
    _pollForFile(physicalPath, fileName, timeOutInMinutes) {
        return __awaiter(this, void 0, void 0, function* () {
            var attempts = 0;
            const retryInterval = 10;
            if (tl.getVariable('appservicedeploy.retrytimeout')) {
                timeOutInMinutes = Number(tl.getVariable('appservicedeploy.retrytimeout'));
                tl.debug('Retry timeout in minutes provided by user: ' + timeOutInMinutes);
            }
            var timeOutInSeconds = timeOutInMinutes * 60;
            var noOfRetry = timeOutInSeconds / retryInterval;
            tl.debug(`Polling started for file:  ${fileName} with retry count: ${noOfRetry}`);
            while (attempts < noOfRetry) {
                attempts += 1;
                var fileContent = yield this._appServiceKuduService.getFileContent(physicalPath, fileName);
                if (fileContent == null) {
                    tl.debug('File: ' + fileName + ' not found. retry after 5 seconds. Attempt: ' + attempts);
                    yield webClient.sleepFor(5);
                }
                else {
                    tl.debug('Found file:  ' + fileName);
                    return;
                }
            }
            if (attempts == noOfRetry) {
                throw new Error(tl.loc('PollingForFileTimeOut'));
            }
        });
    }
    _getUpdateHistoryRequest(isDeploymentSuccess, deploymentID, customMessage) {
        var artifactAlias = tl.getVariable(Constants_1.AzureDeployPackageArtifactAlias);
        var status = isDeploymentSuccess ? constants_1.KUDU_DEPLOYMENT_CONSTANTS.SUCCESS : constants_1.KUDU_DEPLOYMENT_CONSTANTS.FAILED;
        var releaseId = tl.getVariable('release.releaseId');
        var releaseName = tl.getVariable('release.releaseName');
        var collectionUrl = tl.getVariable('system.TeamFoundationCollectionUri');
        var teamProject = tl.getVariable('system.teamProjectId');
        let buildId = '', buildNumber = '', buildProject = '', commitId = '', repoProvider = '', repoName = '', branch = '', repositoryUrl = '', author = '';
        if (releaseId && artifactAlias) {
            // Task is running in release determine build information of selected artifact using artifactAlias
            author = tl.getVariable('release.requestedfor') || tl.getVariable('agent.name');
            tl.debug(`Artifact Source Alias is: ${artifactAlias}`);
            commitId = tl.getVariable(`release.artifacts.${artifactAlias}.sourceVersion`);
            repoProvider = tl.getVariable(`release.artifacts.${artifactAlias}.repository.provider`);
            repoName = tl.getVariable(`release.artifacts.${artifactAlias}.repository.name`);
            branch = tl.getVariable(`release.artifacts.${artifactAlias}.sourcebranchname`) || tl.getVariable(`release.artifacts.${artifactAlias}.sourcebranch`);
            let artifactType = tl.getVariable(`release.artifacts.${artifactAlias}.type`);
            if (artifactType && artifactType.toLowerCase() == "tfvc") {
                repositoryUrl = `${collectionUrl}${buildProject}/_versionControl`;
                repoProvider = "tfsversioncontrol";
            }
            else if (artifactType && artifactType.toLowerCase() == "build") {
                buildId = tl.getVariable(`release.artifacts.${artifactAlias}.buildId`);
                buildNumber = tl.getVariable(`release.artifacts.${artifactAlias}.buildNumber`);
                buildProject = tl.getVariable(`release.artifacts.${artifactAlias}.projectId`);
            }
            else {
                repositoryUrl = tl.getVariable(`release.artifacts.${artifactAlias}.repository.uri`);
            }
        }
        else {
            // Task is running in build OR artifact alias not found so use primary artifact variables
            author = tl.getVariable('build.requestedfor') || tl.getVariable('agent.name');
            buildId = tl.getVariable('build.buildId');
            buildNumber = tl.getVariable('build.buildNumber');
            buildProject = teamProject;
            commitId = tl.getVariable('build.sourceVersion');
            repoName = tl.getVariable('build.repository.name');
            repoProvider = tl.getVariable('build.repository.provider');
            repositoryUrl = tl.getVariable("build.repository.uri") || "";
            branch = tl.getVariable("build.sourcebranchname") || tl.getVariable("build.sourcebranch");
        }
        deploymentID = !!deploymentID ? deploymentID : this.getDeploymentID();
        var message = {
            type: "deployment",
            commitId: commitId,
            buildId: buildId,
            releaseId: releaseId,
            buildNumber: buildNumber,
            releaseName: releaseName,
            repoProvider: repoProvider,
            repoName: repoName,
            collectionUrl: collectionUrl,
            teamProject: teamProject,
            buildProjectUrl: buildProject ? collectionUrl + buildProject : "",
            repositoryUrl: repositoryUrl,
            branch: branch,
            teamProjectName: tl.getVariable("system.teamproject")
        };
        if (!!customMessage) {
            // Append Custom Messages to original message
            for (var attribute in customMessage) {
                message[attribute] = customMessage[attribute];
            }
        }
        var deploymentLogType = message['type'];
        var active = false;
        if (deploymentLogType.toLowerCase() === "deployment" && isDeploymentSuccess) {
            active = true;
        }
        return {
            id: deploymentID,
            active: active,
            status: status,
            message: JSON.stringify(message),
            author: author,
            deployer: 'VSTS'
        };
    }
}
exports.KuduServiceUtility = KuduServiceUtility;
