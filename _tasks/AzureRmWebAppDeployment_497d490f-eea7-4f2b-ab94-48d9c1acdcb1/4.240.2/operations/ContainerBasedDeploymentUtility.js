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
exports.ContainerBasedDeploymentUtility = void 0;
const tl = require("azure-pipelines-task-lib/task");
const url = require("url");
const util = require("util");
const ParameterParserUtility_1 = require("azure-pipelines-tasks-webdeployment-common/ParameterParserUtility");
const AzureAppServiceUtility_1 = require("./AzureAppServiceUtility");
var registryTypes;
(function (registryTypes) {
    registryTypes[registryTypes["AzureContainerRegistry"] = 0] = "AzureContainerRegistry";
    registryTypes[registryTypes["Registry"] = 1] = "Registry";
    registryTypes[registryTypes["PrivateRegistry"] = 2] = "PrivateRegistry";
})(registryTypes || (registryTypes = {}));
class ContainerBasedDeploymentUtility {
    constructor(appService) {
        this._appService = appService;
        this._appServiceUtility = new AzureAppServiceUtility_1.AzureAppServiceUtility(appService);
    }
    deployWebAppImage(taskParameters) {
        return __awaiter(this, void 0, void 0, function* () {
            let imageName = this._getDockerHubImageName();
            tl.debug("Deploying an image " + imageName + " to the webapp " + this._appService.getName());
            tl.debug("Updating the webapp configuration.");
            yield this._updateConfigurationDetails(taskParameters, imageName);
            tl.debug('Updating web app settings');
            yield this._updateApplicationSettings(taskParameters, imageName);
        });
    }
    _updateApplicationSettings(taskParameters, imageName) {
        return __awaiter(this, void 0, void 0, function* () {
            var appSettingsParameters = taskParameters.AppSettings;
            appSettingsParameters = appSettingsParameters ? appSettingsParameters.trim() : "";
            appSettingsParameters = (yield this._getContainerRegistrySettings(imageName, null)) + ' ' + appSettingsParameters;
            var appSettingsNewProperties = ParameterParserUtility_1.parse(appSettingsParameters);
            yield this._appServiceUtility.updateAndMonitorAppSettings(appSettingsNewProperties);
        });
    }
    _updateConfigurationDetails(taskParameters, imageName) {
        return __awaiter(this, void 0, void 0, function* () {
            var startupCommand = taskParameters.StartupCommand;
            var configSettingsParameters = taskParameters.ConfigurationSettings;
            var appSettingsNewProperties = !!configSettingsParameters ? ParameterParserUtility_1.parse(configSettingsParameters.trim()) : {};
            if (!!startupCommand) {
                appSettingsNewProperties.appCommandLine = {
                    'value': startupCommand
                };
            }
            if (taskParameters.isHyperVContainerApp) {
                appSettingsNewProperties.windowsFxVersion = {
                    'value': "DOCKER|" + imageName
                };
            }
            else {
                appSettingsNewProperties.linuxFxVersion = {
                    'value': "DOCKER|" + imageName
                };
            }
            tl.debug(`CONATINER UPDATE CONFIG VALUES : ${appSettingsNewProperties}`);
            yield this._appServiceUtility.updateConfigurationSettings(appSettingsNewProperties);
        });
    }
    getDockerHubImageName() {
        var namespace = tl.getInput('DockerNamespace', true);
        var image = tl.getInput('DockerRepository', true);
        var tag = tl.getInput('DockerImageTag', false);
        return this._constructImageName(namespace, image, tag);
    }
    _getAzureContainerImageName() {
        var registry = tl.getInput('AzureContainerRegistryLoginServer', true) + ".azurecr.io";
        var image = tl.getInput('AzureContainerRegistryImage', true);
        var tag = tl.getInput('AzureContainerRegistryTag', false);
        return this._constructImageName(registry, image, tag);
    }
    _getDockerHubImageName() {
        var namespace = tl.getInput('DockerNamespace', true);
        var image = tl.getInput('DockerRepository', true);
        var tag = tl.getInput('DockerImageTag', false);
        return this._constructImageName(namespace, image, tag);
    }
    _constructImageName(namespace, repository, tag) {
        var imageName = null;
        /*
            Special Case : If release definition is not linked to build artifacts
            then $(Build.BuildId) variable don't expand in release. So clearing state
            of dockerImageTag if $(Build.BuildId) not expanded in value of dockerImageTag.
        */
        if (tag && (tag.trim() == "$(Build.BuildId)")) {
            tag = null;
        }
        if (tag) {
            imageName = namespace.toLowerCase() + "/" + repository.toLowerCase() + ":" + tag;
        }
        else {
            imageName = namespace.toLowerCase() + "/" + repository.toLowerCase();
        }
        return imageName.replace(/ /g, "");
    }
    _getPrivateRegistryImageName() {
        var registryConnectedServiceName = tl.getInput('RegistryConnectedServiceName', true);
        var loginServer = tl.getEndpointAuthorizationParameter(registryConnectedServiceName, 'url', true);
        var registry = url.parse(loginServer).hostname;
        var image = tl.getInput('PrivateRegistryImage', true);
        var tag = tl.getInput('PrivateRegistryTag', false);
        return this._constructImageName(registry, image, tag);
    }
    _updateWebAppSettings(appSettingsParameters, webAppSettings) {
        // In case of public repo, clear the connection details of a registry
        var dockerRespositoryAccess = tl.getInput('DockerRepositoryAccess', true);
        // Uncomment the below lines while supprting all registry types.
        // if(dockerRespositoryAccess === "public")
        // {
        //     deleteRegistryConnectionSettings(webAppSettings);
        // }
        var parsedAppSettings = ParameterParserUtility_1.parse(appSettingsParameters);
        for (var settingName in parsedAppSettings) {
            var setting = settingName.trim();
            var settingVal = parsedAppSettings[settingName].value;
            settingVal = settingVal ? settingVal.trim() : "";
            if (setting) {
                webAppSettings["properties"][setting] = settingVal;
            }
        }
    }
    _getImageName() {
        var registryType = tl.getInput('ImageSource', true);
        var imageName = null;
        switch (registryType) {
            case registryTypes[registryTypes.AzureContainerRegistry]:
                imageName = this._getAzureContainerImageName();
                break;
            case registryTypes[registryTypes.Registry]:
                imageName = this._getDockerHubImageName();
                break;
            case registryTypes[registryTypes.PrivateRegistry]:
                imageName = this._getPrivateRegistryImageName();
                break;
        }
        return imageName;
    }
    _getContainerRegistrySettings(imageName, endPoint) {
        return __awaiter(this, void 0, void 0, function* () {
            var containerRegistryType = 'Registry';
            var containerRegistrySettings = "-DOCKER_CUSTOM_IMAGE_NAME " + imageName;
            var containerRegistryAuthParamsFormatString = "-DOCKER_REGISTRY_SERVER_URL %s -DOCKER_REGISTRY_SERVER_USERNAME %s -DOCKER_REGISTRY_SERVER_PASSWORD %s";
            switch (containerRegistryType) {
                case registryTypes[registryTypes.AzureContainerRegistry]:
                    containerRegistrySettings = yield this._getAzureContainerRegistrySettings(endPoint, containerRegistrySettings, containerRegistryAuthParamsFormatString);
                    break;
                case registryTypes[registryTypes.Registry]:
                    var dockerRespositoryAccess = tl.getInput('DockerRepositoryAccess', false);
                    if (dockerRespositoryAccess === "private") {
                        containerRegistrySettings = this._getDockerPrivateRegistrySettings(containerRegistrySettings, containerRegistryAuthParamsFormatString);
                    }
                    break;
                case registryTypes[registryTypes.PrivateRegistry]:
                    containerRegistrySettings = this._getDockerPrivateRegistrySettings(containerRegistrySettings, containerRegistryAuthParamsFormatString);
                    break;
            }
            return containerRegistrySettings;
        });
    }
    _getAzureContainerRegistrySettings(endPoint, containerRegistrySettings, containerRegistryAuthParamsFormatString) {
        return __awaiter(this, void 0, void 0, function* () {
            var registryServerName = tl.getInput('AzureContainerRegistryLoginServer', true);
            var registryUrl = "https://" + registryServerName + ".azurecr.io";
            tl.debug("Azure Container Registry Url: " + registryUrl);
            var registryName = tl.getInput('AzureContainerRegistry', true);
            var resourceGroupName = ''; // await azureRESTUtility.getResourceGroupName(endPoint, registryName, "Microsoft.ContainerRegistry/registries");
            tl.debug("Resource group name of a registry: " + resourceGroupName);
            var creds = null; //await azureRESTUtility.getAzureContainerRegistryCredentials(endPoint, registryName, resourceGroupName);
            tl.debug("Successfully retrieved the registry credentials");
            var username = creds.username;
            var password = creds["passwords"][0].value;
            return containerRegistrySettings + " " + util.format(containerRegistryAuthParamsFormatString, registryUrl, username, password);
        });
    }
    _getDockerPrivateRegistrySettings(containerRegistrySettings, containerRegistryAuthParamsFormatString) {
        var registryConnectedServiceName = tl.getInput('RegistryConnectedServiceName', true);
        var username = tl.getEndpointAuthorizationParameter(registryConnectedServiceName, 'username', true);
        var password = tl.getEndpointAuthorizationParameter(registryConnectedServiceName, 'password', true);
        var registryUrl = tl.getEndpointAuthorizationParameter(registryConnectedServiceName, 'registry', true);
        tl.debug("Docker or Private Container Registry Url: " + registryUrl);
        return containerRegistrySettings + " " + util.format(containerRegistryAuthParamsFormatString, registryUrl, username, password);
    }
    _deleteRegistryConnectionSettings(webAppSettings) {
        delete webAppSettings["properties"]["DOCKER_REGISTRY_SERVER_URL"];
        delete webAppSettings["properties"]["DOCKER_REGISTRY_SERVER_USERNAME"];
        delete webAppSettings["properties"]["DOCKER_REGISTRY_SERVER_PASSWORD"];
    }
}
exports.ContainerBasedDeploymentUtility = ContainerBasedDeploymentUtility;
