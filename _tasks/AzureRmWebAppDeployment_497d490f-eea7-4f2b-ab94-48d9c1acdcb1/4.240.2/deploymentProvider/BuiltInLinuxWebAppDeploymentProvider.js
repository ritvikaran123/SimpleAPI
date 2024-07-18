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
exports.BuiltInLinuxWebAppDeploymentProvider = void 0;
const AzureRmWebAppDeploymentProvider_1 = require("./AzureRmWebAppDeploymentProvider");
const tl = require("azure-pipelines-task-lib/task");
const packageUtility_1 = require("azure-pipelines-tasks-webdeployment-common/packageUtility");
const ParameterParser = require("azure-pipelines-tasks-webdeployment-common/ParameterParserUtility");
var webCommonUtility = require('azure-pipelines-tasks-webdeployment-common/utility.js');
var deployUtility = require('azure-pipelines-tasks-webdeployment-common/utility.js');
var zipUtility = require('azure-pipelines-tasks-webdeployment-common/ziputility.js');
const linuxFunctionStorageSetting = '-WEBSITES_ENABLE_APP_SERVICE_STORAGE true';
const linuxFunctionRuntimeSettingName = '-FUNCTIONS_WORKER_RUNTIME ';
const linuxFunctionRuntimeSettingValue = new Map([
    ['DOCKER|microsoft/azure-functions-dotnet-core2.0:2.0', 'dotnet '],
    ['DOCKER|microsoft/azure-functions-node8:2.0', 'node '],
    ['DOCKER|microsoft/azure-functions-python3.6:2.0', 'python '],
    ['DOTNET|2.2', 'dotnet '],
    ['DOTNET|3.1', 'dotnet '],
    ['JAVA|8', 'java '],
    ['JAVA|11', 'java '],
    ['NODE|8', 'node '],
    ['NODE|10', 'node '],
    ['NODE|12', 'node '],
    ['NODE|14', 'node '],
    ['PYTHON|3.6', 'python '],
    ['PYTHON|3.7', 'python '],
    ['PYTHON|3.8', 'python ']
]);
class BuiltInLinuxWebAppDeploymentProvider extends AzureRmWebAppDeploymentProvider_1.AzureRmWebAppDeploymentProvider {
    DeployWebAppStep() {
        return __awaiter(this, void 0, void 0, function* () {
            let packageType = this.taskParams.Package.getPackageType();
            let deploymentMethodtelemetry = packageType === packageUtility_1.PackageType.war ? '{"deploymentMethod":"War Deploy"}' : '{"deploymentMethod":"Zip Deploy"}';
            console.log("##vso[telemetry.publish area=TaskDeploymentMethod;feature=AzureWebAppDeployment]" + deploymentMethodtelemetry);
            tl.debug('Performing Linux built-in package deployment');
            var isNewValueUpdated = false;
            if (this.taskParams.isFunctionApp) {
                var linuxFunctionRuntimeSetting = "";
                if (this.taskParams.RuntimeStack) {
                    linuxFunctionRuntimeSetting = linuxFunctionRuntimeSettingName + linuxFunctionRuntimeSettingValue.get(this.taskParams.RuntimeStack);
                }
                var linuxFunctionAppSetting = linuxFunctionRuntimeSetting + linuxFunctionStorageSetting;
                var customApplicationSetting = ParameterParser.parse(linuxFunctionAppSetting);
                isNewValueUpdated = yield this.appServiceUtility.updateAndMonitorAppSettings(customApplicationSetting);
            }
            if (!isNewValueUpdated) {
                yield this.kuduServiceUtility.warmpUp();
            }
            switch (packageType) {
                case packageUtility_1.PackageType.folder:
                    let tempPackagePath = deployUtility.generateTemporaryFolderOrZipPath(tl.getVariable('AGENT.TEMPDIRECTORY'), false);
                    let archivedWebPackage = yield zipUtility.archiveFolder(this.taskParams.Package.getPath(), "", tempPackagePath);
                    tl.debug("Compressed folder into zip " + archivedWebPackage);
                    this.zipDeploymentID = yield this.kuduServiceUtility.deployUsingZipDeploy(archivedWebPackage, this.taskParams.TakeAppOfflineFlag, { slotName: this.appService.getSlot() });
                    break;
                case packageUtility_1.PackageType.zip:
                    this.zipDeploymentID = yield this.kuduServiceUtility.deployUsingZipDeploy(this.taskParams.Package.getPath(), this.taskParams.TakeAppOfflineFlag, { slotName: this.appService.getSlot() });
                    break;
                case packageUtility_1.PackageType.jar:
                    tl.debug("Initiated deployment via kudu service for webapp jar package : " + this.taskParams.Package.getPath());
                    var folderPath = yield webCommonUtility.generateTemporaryFolderForDeployment(false, this.taskParams.Package.getPath(), packageUtility_1.PackageType.jar);
                    var output = yield webCommonUtility.archiveFolderForDeployment(false, folderPath);
                    var webPackage = output.webDeployPkg;
                    tl.debug("Initiated deployment via kudu service for webapp jar package : " + webPackage);
                    this.zipDeploymentID = yield this.kuduServiceUtility.deployUsingZipDeploy(webPackage, this.taskParams.TakeAppOfflineFlag, { slotName: this.appService.getSlot() });
                    break;
                case packageUtility_1.PackageType.war:
                    tl.debug("Initiated deployment via kudu service for webapp war package : " + this.taskParams.Package.getPath());
                    var warName = webCommonUtility.getFileNameFromPath(this.taskParams.Package.getPath(), ".war");
                    this.zipDeploymentID = yield this.kuduServiceUtility.deployUsingWarDeploy(this.taskParams.Package.getPath(), { slotName: this.appService.getSlot() }, warName);
                    break;
                default:
                    throw new Error(tl.loc('Invalidwebapppackageorfolderpathprovided', this.taskParams.Package.getPath()));
            }
            yield this.appServiceUtility.updateStartupCommandAndRuntimeStack(this.taskParams.RuntimeStack, this.taskParams.StartupCommand);
            yield this.PostDeploymentStep();
        });
    }
    UpdateDeploymentStatus(isDeploymentSuccess) {
        const _super = Object.create(null, {
            UpdateDeploymentStatus: { get: () => super.UpdateDeploymentStatus }
        });
        return __awaiter(this, void 0, void 0, function* () {
            if (this.kuduServiceUtility) {
                yield _super.UpdateDeploymentStatus.call(this, isDeploymentSuccess);
                if (this.zipDeploymentID && this.activeDeploymentID && isDeploymentSuccess) {
                    yield this.kuduServiceUtility.postZipDeployOperation(this.zipDeploymentID, this.activeDeploymentID);
                }
            }
        });
    }
}
exports.BuiltInLinuxWebAppDeploymentProvider = BuiltInLinuxWebAppDeploymentProvider;
