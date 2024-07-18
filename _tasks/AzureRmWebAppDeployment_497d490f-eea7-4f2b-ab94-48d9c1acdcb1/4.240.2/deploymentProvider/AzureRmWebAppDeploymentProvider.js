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
exports.AzureRmWebAppDeploymentProvider = void 0;
const azure_arm_endpoint_1 = require("azure-pipelines-tasks-azure-arm-rest/azure-arm-endpoint");
const AzureResourceFilterUtility_1 = require("../operations/AzureResourceFilterUtility");
const KuduServiceUtility_1 = require("../operations/KuduServiceUtility");
const azure_arm_app_service_1 = require("azure-pipelines-tasks-azure-arm-rest/azure-arm-app-service");
const AzureAppServiceUtility_1 = require("../operations/AzureAppServiceUtility");
const tl = require("azure-pipelines-task-lib/task");
const ParameterParser = require("azure-pipelines-tasks-webdeployment-common/ParameterParserUtility");
const ReleaseAnnotationUtility_1 = require("../operations/ReleaseAnnotationUtility");
const packageUtility_1 = require("azure-pipelines-tasks-webdeployment-common/packageUtility");
const Constants_1 = require("../operations/Constants");
class AzureRmWebAppDeploymentProvider {
    constructor(taskParams) {
        this.virtualApplicationPath = "";
        this.taskParams = taskParams;
        let packageArtifactAlias = this.taskParams.Package ? packageUtility_1.PackageUtility.getArtifactAlias(this.taskParams.Package.getPath()) : null;
        tl.setVariable(Constants_1.AzureDeployPackageArtifactAlias, packageArtifactAlias);
    }
    PreDeploymentStep() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.taskParams.WebAppKind.includes("functionAppContainer")) {
                tl.warning(`Recommendation: Use Azure Functions for container Task to deploy Function app.`);
            }
            else if (this.taskParams.WebAppKind.includes("functionApp")) {
                tl.warning(`Recommendation: Use Azure Functions Task to deploy Function app.`);
            }
            this.azureEndpoint = yield new azure_arm_endpoint_1.AzureRMEndpoint(this.taskParams.connectedServiceName).getEndpoint();
            console.log(tl.loc('GotconnectiondetailsforazureRMWebApp0', this.taskParams.WebAppName));
            if (!this.taskParams.DeployToSlotOrASEFlag) {
                this.taskParams.ResourceGroupName = yield AzureResourceFilterUtility_1.AzureResourceFilterUtility.getResourceGroupName(this.azureEndpoint, this.taskParams.WebAppName);
            }
            this.appService = new azure_arm_app_service_1.AzureAppService(this.azureEndpoint, this.taskParams.ResourceGroupName, this.taskParams.WebAppName, this.taskParams.SlotName, this.taskParams.WebAppKind);
            this.appServiceUtility = new AzureAppServiceUtility_1.AzureAppServiceUtility(this.appService);
            this.kuduService = yield this.appServiceUtility.getKuduService();
            this.kuduServiceUtility = new KuduServiceUtility_1.KuduServiceUtility(this.kuduService);
            tl.debug(`Resource Group: ${this.taskParams.ResourceGroupName}`);
        });
    }
    DeployWebAppStep() {
        return __awaiter(this, void 0, void 0, function* () { });
    }
    UpdateDeploymentStatus(isDeploymentSuccess) {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.kuduServiceUtility) {
                yield ReleaseAnnotationUtility_1.addReleaseAnnotation(this.azureEndpoint, this.appService, isDeploymentSuccess);
                this.activeDeploymentID = yield this.kuduServiceUtility.updateDeploymentStatus(isDeploymentSuccess, null, { 'type': 'Deployment', slotName: this.appService.getSlot() });
                tl.debug('Active DeploymentId :' + this.activeDeploymentID);
            }
            if (this.appServiceUtility) {
                let appServiceApplicationUrl = yield this.appServiceUtility.getApplicationURL(!this.taskParams.isLinuxApp
                    ? this.taskParams.VirtualApplication : null);
                console.log(tl.loc('AppServiceApplicationURL', appServiceApplicationUrl));
                tl.setVariable('AppServiceApplicationUrl', appServiceApplicationUrl);
            }
        });
    }
    PostDeploymentStep() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.taskParams.AppSettings) {
                var customApplicationSettings = ParameterParser.parse(this.taskParams.AppSettings);
                yield this.appServiceUtility.updateAndMonitorAppSettings(customApplicationSettings);
            }
            if (this.taskParams.ConfigurationSettings) {
                var customApplicationSettings = ParameterParser.parse(this.taskParams.ConfigurationSettings);
                yield this.appServiceUtility.updateConfigurationSettings(customApplicationSettings);
            }
            if (this.taskParams.ScriptType) {
                yield this.kuduServiceUtility.runPostDeploymentScript(this.taskParams, this.virtualApplicationPath);
            }
            yield this.appServiceUtility.updateScmTypeAndConfigurationDetails();
        });
    }
}
exports.AzureRmWebAppDeploymentProvider = AzureRmWebAppDeploymentProvider;
