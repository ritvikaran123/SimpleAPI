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
exports.WebDeployUtility = void 0;
const tl = require("azure-pipelines-task-lib/task");
const msdeployutility_1 = require("azure-pipelines-tasks-webdeployment-common/msdeployutility");
const deployusingmsdeploy_1 = require("azure-pipelines-tasks-webdeployment-common/deployusingmsdeploy");
const utility_1 = require("azure-pipelines-tasks-webdeployment-common/utility");
const DEFAULT_RETRY_COUNT = 3;
class WebDeployUtility {
    constructor(azureAppServiceUtility) {
        this._azureAppServiceUtility = azureAppServiceUtility;
    }
    publishUsingWebDeploy(taskParameters) {
        return __awaiter(this, void 0, void 0, function* () {
            const webDeployArguments = yield this.constructWebDeployArguments(taskParameters);
            const retryCountParam = tl.getVariable("appservice.msdeployretrycount");
            let retryCount = (retryCountParam && !isNaN(Number(retryCountParam))) ? Number(retryCountParam) : DEFAULT_RETRY_COUNT;
            let webDeployResult;
            while (retryCount > 0) {
                webDeployResult = yield deployusingmsdeploy_1.executeWebDeploy(webDeployArguments);
                if (!webDeployResult.isSuccess) {
                    yield this.webDeployRecommendationForIssue(taskParameters, webDeployResult.errorCode, false);
                }
                else {
                    break;
                }
                retryCount--;
            }
            if (webDeployArguments.setParametersFile) {
                try {
                    tl.rmRF(webDeployArguments.setParametersFile);
                }
                catch (error) {
                    tl.debug('unable to delete setparams file: ');
                    tl.debug(error);
                }
            }
            if (!webDeployResult.isSuccess) {
                yield this.webDeployRecommendationForIssue(taskParameters, webDeployResult.errorCode, true);
                throw new Error(webDeployResult.error);
            }
        });
    }
    constructWebDeployArguments(taskParameters) {
        return __awaiter(this, void 0, void 0, function* () {
            const publishProfile = yield this._azureAppServiceUtility.getWebDeployPublishingProfile();
            const webDeployArguments = {};
            if (yield this._azureAppServiceUtility.isSitePublishingCredentialsEnabled()) {
                tl.debug("Using Basic authentication.");
                webDeployArguments.authType = "Basic";
                webDeployArguments.userName = publishProfile.userName;
                webDeployArguments.password = publishProfile.userPWD;
            }
            else if (!msdeployutility_1.shouldUseMSDeployTokenAuth()) {
                throw new Error(tl.loc("BasicAuthNotSupported"));
            }
            else if ((yield msdeployutility_1.installedMSDeployVersionSupportsTokenAuth()) === false) {
                throw new Error(tl.loc("MSDeployNotSupportTokenAuth"));
            }
            else {
                tl.debug("Basic authentication is disabled, using token based authentication.");
                webDeployArguments.authType = "Bearer";
                webDeployArguments.password = yield this._azureAppServiceUtility.getAuthToken();
                webDeployArguments.userName = "user"; // arbitrary but not empty
            }
            webDeployArguments.publishUrl = publishProfile.publishUrl;
            webDeployArguments.package = taskParameters.Package;
            webDeployArguments.additionalArguments = taskParameters.AdditionalArguments;
            webDeployArguments.appName = taskParameters.WebAppName;
            webDeployArguments.excludeFilesFromAppDataFlag = taskParameters.ExcludeFilesFromAppDataFlag;
            webDeployArguments.removeAdditionalFilesFlag = taskParameters.RemoveAdditionalFilesFlag;
            webDeployArguments.takeAppOfflineFlag = taskParameters.TakeAppOfflineFlag;
            webDeployArguments.useWebDeploy = taskParameters.UseWebDeploy;
            webDeployArguments.virtualApplication = taskParameters.VirtualApplication;
            const setParametersFile = utility_1.copySetParamFileIfItExists(taskParameters.SetParametersFile);
            if (setParametersFile) {
                webDeployArguments.setParametersFile = setParametersFile.slice(setParametersFile.lastIndexOf('\\') + 1, setParametersFile.length);
            }
            return webDeployArguments;
        });
    }
    webDeployRecommendationForIssue(taskParameters, errorCode, isRecommendation) {
        return __awaiter(this, void 0, void 0, function* () {
            switch (errorCode) {
                case 'ERROR_CONNECTION_TERMINATED': {
                    if (!isRecommendation) {
                        yield this._azureAppServiceUtility.pingApplication();
                    }
                    break;
                }
                case 'ERROR_INSUFFICIENT_ACCESS_TO_SITE_FOLDER': {
                    tl.warning(tl.loc("Trytodeploywebappagainwithappofflineoptionselected"));
                    break;
                }
                case 'WebJobsInProgressIssue': {
                    tl.warning(tl.loc('WebJobsInProgressIssue'));
                    break;
                }
                case 'FILE_IN_USE': {
                    if (!isRecommendation && taskParameters.RenameFilesFlag) {
                        yield this._azureAppServiceUtility.enableRenameLockedFiles();
                    }
                    else {
                        tl.warning(tl.loc("Trytodeploywebappagainwithrenamefileoptionselected"));
                        tl.warning(tl.loc("RunFromZipPreventsFileInUseError"));
                    }
                    break;
                }
                case 'transport connection': {
                    tl.warning(tl.loc("Updatemachinetoenablesecuretlsprotocol"));
                    break;
                }
                case 'ERROR_CERTIFICATE_VALIDATION_FAILED': {
                    if (isRecommendation) {
                        tl.warning(tl.loc('ASE_WebDeploySSLIssueRecommendation'));
                    }
                    break;
                }
                default:
                    break;
            }
        });
    }
}
exports.WebDeployUtility = WebDeployUtility;
