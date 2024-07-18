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
exports.ContainerWebAppDeploymentProvider = void 0;
const AzureRmWebAppDeploymentProvider_1 = require("./AzureRmWebAppDeploymentProvider");
const tl = require("azure-pipelines-task-lib/task");
const ParameterParser = require("azure-pipelines-tasks-webdeployment-common/ParameterParserUtility");
const ContainerBasedDeploymentUtility_1 = require("../operations/ContainerBasedDeploymentUtility");
const linuxFunctionStorageSetting = '-WEBSITES_ENABLE_APP_SERVICE_STORAGE false';
class ContainerWebAppDeploymentProvider extends AzureRmWebAppDeploymentProvider_1.AzureRmWebAppDeploymentProvider {
    DeployWebAppStep() {
        return __awaiter(this, void 0, void 0, function* () {
            tl.debug("Performing container based deployment.");
            if (this.taskParams.isFunctionApp) {
                var customApplicationSetting = ParameterParser.parse(linuxFunctionStorageSetting);
                yield this.appServiceUtility.updateAndMonitorAppSettings(customApplicationSetting);
            }
            let containerDeploymentUtility = new ContainerBasedDeploymentUtility_1.ContainerBasedDeploymentUtility(this.appService);
            yield containerDeploymentUtility.deployWebAppImage(this.taskParams);
            if (this.taskParams.ScriptType) {
                yield this.kuduServiceUtility.runPostDeploymentScript(this.taskParams);
            }
            yield this.appServiceUtility.updateScmTypeAndConfigurationDetails();
        });
    }
}
exports.ContainerWebAppDeploymentProvider = ContainerWebAppDeploymentProvider;
