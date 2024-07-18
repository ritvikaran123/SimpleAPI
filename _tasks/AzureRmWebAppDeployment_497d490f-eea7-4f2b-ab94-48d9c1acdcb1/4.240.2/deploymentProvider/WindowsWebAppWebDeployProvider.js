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
exports.WindowsWebAppWebDeployProvider = void 0;
const AzureRmWebAppDeploymentProvider_1 = require("./AzureRmWebAppDeploymentProvider");
const tl = require("azure-pipelines-task-lib/task");
const FileTransformsUtility_1 = require("../operations/FileTransformsUtility");
const ParameterParser = require("azure-pipelines-tasks-webdeployment-common/ParameterParserUtility");
const Constant = require("../operations/Constants");
const WebDeployUtility_1 = require("../operations/WebDeployUtility");
const packageUtility_1 = require("azure-pipelines-tasks-webdeployment-common/packageUtility");
const removeRunFromZipAppSetting = '-WEBSITE_RUN_FROM_ZIP -WEBSITE_RUN_FROM_PACKAGE';
var deployUtility = require('azure-pipelines-tasks-webdeployment-common/utility.js');
class WindowsWebAppWebDeployProvider extends AzureRmWebAppDeploymentProvider_1.AzureRmWebAppDeploymentProvider {
    DeployWebAppStep() {
        return __awaiter(this, void 0, void 0, function* () {
            var physicalPath = Constant.SiteRoot;
            var webPackage = this.taskParams.Package.getPath();
            if (this.taskParams.VirtualApplication) {
                physicalPath = yield this.appServiceUtility.getPhysicalPath(this.taskParams.VirtualApplication);
                yield this.kuduServiceUtility.createPathIfRequired(physicalPath);
                this.virtualApplicationPath = physicalPath;
            }
            webPackage = yield FileTransformsUtility_1.FileTransformsUtility.applyTransformations(webPackage, this.taskParams);
            this.taskParams.Package = new packageUtility_1.Package(webPackage);
            var deleteApplicationSetting = ParameterParser.parse(removeRunFromZipAppSetting);
            yield this.appServiceUtility.updateAndMonitorAppSettings(null, deleteApplicationSetting);
            if (deployUtility.canUseWebDeploy(this.taskParams.UseWebDeploy)) {
                const webDeployUtility = new WebDeployUtility_1.WebDeployUtility(this.appServiceUtility);
                const deploymentMethodtelemetry = '{"deploymentMethod":"Web Deploy"}';
                console.log("##vso[telemetry.publish area=TaskDeploymentMethod;feature=AzureWebAppDeployment]" + deploymentMethodtelemetry);
                tl.debug("Performing the deployment of webapp.");
                if (tl.getPlatform() !== tl.Platform.Windows) {
                    throw Error(tl.loc("PublishusingwebdeployoptionsaresupportedonlywhenusingWindowsagent"));
                }
                yield webDeployUtility.publishUsingWebDeploy(this.taskParams);
            }
            else {
                const deploymentMethodtelemetry = '{"deploymentMethod":"Zip API"}';
                console.log("##vso[telemetry.publish area=TaskDeploymentMethod;feature=AzureWebAppDeployment]" + deploymentMethodtelemetry);
                tl.debug("Initiated deployment via kudu service for webapp package : ");
                yield this.kuduServiceUtility.deployWebPackage(webPackage, physicalPath, this.taskParams.VirtualApplication, this.taskParams.TakeAppOfflineFlag);
            }
            yield this.PostDeploymentStep();
        });
    }
}
exports.WindowsWebAppWebDeployProvider = WindowsWebAppWebDeployProvider;
