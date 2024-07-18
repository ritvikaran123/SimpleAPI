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
exports.AzureAppServiceUtility = void 0;
const tl = require("azure-pipelines-task-lib/task");
const webClient = require("azure-pipelines-tasks-azure-arm-rest/webClient");
var parseString = require('xml2js').parseString;
const Q = require("q");
const Constants_1 = require("./Constants");
const azureAppServiceUtility_1 = require("azure-pipelines-tasks-azure-arm-rest/azureAppServiceUtility");
//todo replace this class with azure-arm-rest/azureAppServiceUtility
class AzureAppServiceUtility {
    constructor(appService) {
        this._appService = appService;
    }
    updateScmTypeAndConfigurationDetails() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                var configDetails = yield this._appService.getConfiguration();
                var scmType = configDetails.properties.scmType;
                let shouldUpdateMetadata = false;
                if (scmType && scmType.toLowerCase() === "none") {
                    configDetails.properties.scmType = 'VSTSRM';
                    tl.debug('updating SCM Type to VSTS-RM');
                    yield this._appService.updateConfiguration(configDetails);
                    tl.debug('updated SCM Type to VSTS-RM');
                    shouldUpdateMetadata = true;
                }
                else if (scmType && scmType.toLowerCase() == "vstsrm") {
                    tl.debug("SCM Type is VSTSRM");
                    shouldUpdateMetadata = true;
                }
                else {
                    tl.debug(`Skipped updating the SCM value. Value: ${scmType}`);
                }
                if (shouldUpdateMetadata) {
                    tl.debug('Updating metadata with latest pipeline details');
                    let newMetadataProperties = this._getNewMetadata();
                    let siteMetadata = yield this._appService.getMetadata();
                    let skipUpdate = true;
                    for (let property in newMetadataProperties) {
                        if (siteMetadata.properties[property] !== newMetadataProperties[property]) {
                            siteMetadata.properties[property] = newMetadataProperties[property];
                            skipUpdate = false;
                        }
                    }
                    if (!skipUpdate) {
                        yield this._appService.patchMetadata(siteMetadata.properties);
                        tl.debug('Updated metadata with latest pipeline details');
                        console.log(tl.loc("SuccessfullyUpdatedAzureRMWebAppConfigDetails"));
                    }
                    else {
                        tl.debug("No changes in metadata properties, skipping update.");
                    }
                }
            }
            catch (error) {
                tl.warning(tl.loc("FailedToUpdateAzureRMWebAppConfigDetails", error));
            }
        });
    }
    getWebDeployPublishingProfile() {
        return __awaiter(this, void 0, void 0, function* () {
            var publishingProfile = yield this._appService.getPublishingProfileWithSecrets();
            var defer = Q.defer();
            parseString(publishingProfile, (error, result) => {
                if (!!error) {
                    defer.reject(error);
                }
                var publishProfile = result && result.publishData && result.publishData.publishProfile ? result.publishData.publishProfile : null;
                if (publishProfile) {
                    for (var index in publishProfile) {
                        if (publishProfile[index].$ && publishProfile[index].$.publishMethod === "MSDeploy") {
                            defer.resolve(result.publishData.publishProfile[index].$);
                        }
                    }
                }
                defer.reject(tl.loc('ErrorNoSuchDeployingMethodExists'));
            });
            return defer.promise;
        });
    }
    getApplicationURL(virtualApplication) {
        return __awaiter(this, void 0, void 0, function* () {
            let webDeployProfile = yield this.getWebDeployPublishingProfile();
            return (yield webDeployProfile.destinationAppUrl) + (virtualApplication ? "/" + virtualApplication : "");
        });
    }
    pingApplication() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                var applicationUrl = yield this.getApplicationURL();
                if (!applicationUrl) {
                    tl.debug("Application Url not found.");
                    return;
                }
                yield AzureAppServiceUtility.pingApplication(applicationUrl);
            }
            catch (error) {
                tl.debug("Unable to ping App Service. Error: ${error}");
            }
        });
    }
    static pingApplication(applicationUrl) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!applicationUrl) {
                tl.debug('Application Url empty.');
                return;
            }
            try {
                var webRequest = new webClient.WebRequest();
                webRequest.method = 'GET';
                webRequest.uri = applicationUrl;
                let webRequestOptions = { retriableErrorCodes: [], retriableStatusCodes: [], retryCount: 1, retryIntervalInSeconds: 5, retryRequestTimedout: true };
                var response = yield webClient.sendRequest(webRequest, webRequestOptions);
                tl.debug(`App Service status Code: '${response.statusCode}'. Status Message: '${response.statusMessage}'`);
            }
            catch (error) {
                tl.debug(`Unable to ping App Service. Error: ${error}`);
            }
        });
    }
    getKuduService() {
        return __awaiter(this, void 0, void 0, function* () {
            const utility = new azureAppServiceUtility_1.AzureAppServiceUtility(this._appService);
            return yield utility.getKuduService();
        });
    }
    isSitePublishingCredentialsEnabled() {
        return __awaiter(this, void 0, void 0, function* () {
            const utility = new azureAppServiceUtility_1.AzureAppServiceUtility(this._appService);
            return yield utility.isSitePublishingCredentialsEnabled();
        });
    }
    getAuthToken() {
        return __awaiter(this, void 0, void 0, function* () {
            const token = yield this._appService._client.getCredentials().getToken();
            tl.setSecret(token);
            return token;
        });
    }
    getPhysicalPath(virtualApplication) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!virtualApplication) {
                return '/site/wwwroot';
            }
            virtualApplication = (virtualApplication.startsWith("/")) ? virtualApplication.substr(1) : virtualApplication;
            var physicalToVirtualPathMap = yield this._getPhysicalToVirtualPathMap(virtualApplication);
            if (!physicalToVirtualPathMap) {
                throw Error(tl.loc("VirtualApplicationDoesNotExist", virtualApplication));
            }
            tl.debug(`Virtual Application Map: Physical path: '${physicalToVirtualPathMap.physicalPath}'. Virtual path: '${physicalToVirtualPathMap.virtualPath}'.`);
            return physicalToVirtualPathMap.physicalPath;
        });
    }
    updateConfigurationSettings(properties) {
        return __awaiter(this, void 0, void 0, function* () {
            for (var property in properties) {
                if (!!properties[property] && properties[property].value !== undefined) {
                    properties[property] = properties[property].value;
                }
            }
            console.log(tl.loc('UpdatingAppServiceConfigurationSettings', JSON.stringify(properties)));
            yield this._appService.patchConfiguration({ 'properties': properties });
            console.log(tl.loc('UpdatedAppServiceConfigurationSettings'));
        });
    }
    updateAndMonitorAppSettings(addProperties, deleteProperties) {
        return __awaiter(this, void 0, void 0, function* () {
            for (var property in addProperties) {
                if (!!addProperties[property] && addProperties[property].value !== undefined) {
                    addProperties[property] = addProperties[property].value;
                }
            }
            console.log(tl.loc('UpdatingAppServiceApplicationSettings', JSON.stringify(addProperties)));
            var isNewValueUpdated = yield this._appService.patchApplicationSettings(addProperties, deleteProperties);
            if (!!isNewValueUpdated) {
                console.log(tl.loc('UpdatedAppServiceApplicationSettings'));
            }
            else {
                console.log(tl.loc('AppServiceApplicationSettingsAlreadyPresent'));
                return isNewValueUpdated;
            }
            var kuduService = yield this.getKuduService();
            var noOftimesToIterate = 12;
            tl.debug('retrieving values from Kudu service to check if new values are updated');
            while (noOftimesToIterate > 0) {
                var kuduServiceAppSettings = yield kuduService.getAppSettings();
                var propertiesChanged = true;
                for (var property in addProperties) {
                    if (kuduServiceAppSettings[property] != addProperties[property]) {
                        tl.debug('New properties are not updated in Kudu service :(');
                        propertiesChanged = false;
                        break;
                    }
                }
                for (var property in deleteProperties) {
                    if (kuduServiceAppSettings[property]) {
                        tl.debug('Deleted properties are not reflected in Kudu service :(');
                        propertiesChanged = false;
                        break;
                    }
                }
                if (propertiesChanged) {
                    tl.debug('New properties are updated in Kudu service.');
                    console.log(tl.loc('UpdatedAppServiceApplicationSettings'));
                    return isNewValueUpdated;
                }
                noOftimesToIterate -= 1;
                yield webClient.sleepFor(5);
            }
            tl.debug('Timing out from app settings check');
            return isNewValueUpdated;
        });
    }
    enableRenameLockedFiles() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                var webAppSettings = yield this._appService.getApplicationSettings();
                if (webAppSettings && webAppSettings.properties) {
                    if (webAppSettings.properties.MSDEPLOY_RENAME_LOCKED_FILES !== '1') {
                        tl.debug(`Rename locked files value found to be ${webAppSettings.properties.MSDEPLOY_RENAME_LOCKED_FILES}. Updating the value to 1`);
                        yield this.updateAndMonitorAppSettings({ 'MSDEPLOY_RENAME_LOCKED_FILES': '1' });
                        console.log(tl.loc('RenameLockedFilesEnabled'));
                    }
                    else {
                        tl.debug('Rename locked files is already enabled in App Service');
                    }
                }
            }
            catch (error) {
                throw new Error(tl.loc('FailedToEnableRenameLockedFiles', error));
            }
        });
    }
    updateStartupCommandAndRuntimeStack(runtimeStack, startupCommand) {
        return __awaiter(this, void 0, void 0, function* () {
            var configDetails = yield this._appService.getConfiguration();
            var appCommandLine = configDetails.properties.appCommandLine;
            startupCommand = (!!startupCommand) ? startupCommand : appCommandLine;
            var linuxFxVersion = configDetails.properties.linuxFxVersion;
            runtimeStack = (!!runtimeStack) ? runtimeStack : linuxFxVersion;
            if (appCommandLine != startupCommand || runtimeStack != linuxFxVersion) {
                yield this.updateConfigurationSettings({ linuxFxVersion: runtimeStack, appCommandLine: startupCommand });
            }
            else {
                tl.debug(`Skipped updating the values. linuxFxVersion: ${linuxFxVersion} : appCommandLine: ${appCommandLine}`);
            }
        });
    }
    _getPhysicalToVirtualPathMap(virtualApplication) {
        return __awaiter(this, void 0, void 0, function* () {
            // construct URL depending on virtualApplication or root of webapplication 
            var physicalPath = null;
            var virtualPath = "/" + virtualApplication;
            var appConfigSettings = yield this._appService.getConfiguration();
            var virtualApplicationMappings = appConfigSettings.properties && appConfigSettings.properties.virtualApplications;
            if (virtualApplicationMappings) {
                for (var mapping of virtualApplicationMappings) {
                    if (mapping.virtualPath.toLowerCase() == virtualPath.toLowerCase()) {
                        physicalPath = mapping.physicalPath;
                        break;
                    }
                }
            }
            return physicalPath ? {
                'virtualPath': virtualPath,
                'physicalPath': physicalPath
            } : null;
        });
    }
    _getNewMetadata() {
        var collectionUri = tl.getVariable("system.teamfoundationCollectionUri");
        var projectId = tl.getVariable("system.teamprojectId");
        var releaseDefinitionId = tl.getVariable("release.definitionId");
        // Log metadata properties based on whether task is running in build OR release.
        let newProperties = {
            VSTSRM_ProjectId: projectId,
            VSTSRM_AccountId: tl.getVariable("system.collectionId")
        };
        if (!!releaseDefinitionId) {
            // Task is running in Release
            var artifactAlias = tl.getVariable(Constants_1.AzureDeployPackageArtifactAlias);
            tl.debug("Artifact Source Alias is: " + artifactAlias);
            let buildDefinitionUrl = "";
            let buildDefintionId = "";
            if (artifactAlias) {
                let artifactType = tl.getVariable(`release.artifacts.${artifactAlias}.type`);
                // Get build definition info only when artifact type is build.
                if (artifactType && artifactType.toLowerCase() == "build") {
                    buildDefintionId = tl.getVariable("build.definitionId");
                    let buildProjectId = tl.getVariable("build.projectId") || projectId;
                    let artifactBuildDefinitionId = tl.getVariable("release.artifacts." + artifactAlias + ".definitionId");
                    let artifactBuildProjectId = tl.getVariable("release.artifacts." + artifactAlias + ".projectId");
                    if (artifactBuildDefinitionId && artifactBuildProjectId) {
                        buildDefintionId = artifactBuildDefinitionId;
                        buildProjectId = artifactBuildProjectId;
                    }
                    buildDefinitionUrl = collectionUri + buildProjectId + "/_build?_a=simple-process&definitionId=" + buildDefintionId;
                }
            }
            newProperties["VSTSRM_BuildDefinitionId"] = buildDefintionId;
            newProperties["VSTSRM_ReleaseDefinitionId"] = releaseDefinitionId;
            newProperties["VSTSRM_BuildDefinitionWebAccessUrl"] = buildDefinitionUrl;
            newProperties["VSTSRM_ConfiguredCDEndPoint"] = collectionUri + projectId + "/_apps/hub/ms.vss-releaseManagement-web.hub-explorer?definitionId=" + releaseDefinitionId;
        }
        else {
            // Task is running in Build
            let buildDefintionId = tl.getVariable("system.definitionId");
            newProperties["VSTSRM_BuildDefinitionId"] = buildDefintionId;
            let buildDefinitionUrl = collectionUri + projectId + "/_build?_a=simple-process&definitionId=" + buildDefintionId;
            newProperties["VSTSRM_BuildDefinitionWebAccessUrl"] = buildDefinitionUrl;
            newProperties["VSTSRM_ConfiguredCDEndPoint"] = buildDefinitionUrl;
        }
        return newProperties;
    }
}
exports.AzureAppServiceUtility = AzureAppServiceUtility;
