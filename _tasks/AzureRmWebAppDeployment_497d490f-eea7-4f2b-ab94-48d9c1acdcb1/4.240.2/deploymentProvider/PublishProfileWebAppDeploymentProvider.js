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
exports.PublishProfileWebAppDeploymentProvider = void 0;
const PublishProfileUtility_1 = require("../operations/PublishProfileUtility");
const FileTransformsUtility_1 = require("../operations/FileTransformsUtility");
const AzureAppServiceUtility_1 = require("../operations/AzureAppServiceUtility");
const Constant = require("../operations/Constants");
const tl = require("azure-pipelines-task-lib/task");
const fs = require("fs");
const path = require("path");
var packageUtility = require('azure-pipelines-tasks-webdeployment-common/packageUtility.js');
var deployUtility = require('azure-pipelines-tasks-webdeployment-common/utility.js');
var msDeployUtility = require('azure-pipelines-tasks-webdeployment-common/msdeployutility.js');
const DEFAULT_RETRY_COUNT = 3;
class PublishProfileWebAppDeploymentProvider {
    constructor(taskParams) {
        this.taskParams = taskParams;
    }
    PreDeploymentStep() {
        return __awaiter(this, void 0, void 0, function* () {
            this.publishProfileUtility = new PublishProfileUtility_1.PublishProfileUtility(this.taskParams.PublishProfilePath);
            try {
                var siteUrl = yield this.publishProfileUtility.GetPropertyValuefromPublishProfile(Constant.PublishProfileXml.SiteUrlToLaunchAfterPublish);
                yield AzureAppServiceUtility_1.AzureAppServiceUtility.pingApplication(siteUrl);
                tl.setVariable('AppServiceApplicationUrl', siteUrl);
            }
            catch (error) {
                tl.debug('Unable to ping webapp, Error: ' + error);
            }
        });
    }
    DeployWebAppStep() {
        return __awaiter(this, void 0, void 0, function* () {
            if (!tl.osType().match(/^Win/)) {
                throw Error(tl.loc("PublishusingwebdeployoptionsaresupportedonlywhenusingWindowsagent"));
            }
            tl.debug("Performing the deployment of webapp using publish profile.");
            var applyFileTransformFlag = this.taskParams.JSONFiles.length != 0 || this.taskParams.XmlTransformation || this.taskParams.XmlVariableSubstitution;
            if (applyFileTransformFlag) {
                yield this.ApplyFileTransformation();
            }
            var msDeployPublishingProfile = yield this.publishProfileUtility.GetTaskParametersFromPublishProfileFile(this.taskParams);
            var deployCmdFilePath = this.GetDeployCmdFilePath();
            yield this.SetMsdeployEnvPath();
            var cmdArgs = this.GetDeployScriptCmdArgs(msDeployPublishingProfile);
            var retryCountParam = tl.getVariable("appservice.msdeployretrycount");
            var retryCount = (retryCountParam && !(isNaN(Number(retryCountParam)))) ? Number(retryCountParam) : DEFAULT_RETRY_COUNT;
            try {
                while (true) {
                    try {
                        retryCount -= 1;
                        yield this.publishProfileUtility.RunCmd(deployCmdFilePath, cmdArgs);
                        break;
                    }
                    catch (error) {
                        if (retryCount == 0) {
                            throw error;
                        }
                        console.log(error);
                        console.log(tl.loc('RetryToDeploy'));
                    }
                }
                console.log(tl.loc('PackageDeploymentSuccess'));
            }
            catch (error) {
                tl.error(tl.loc('PackageDeploymentFailed'));
                tl.debug(JSON.stringify(error));
                msDeployUtility.redirectMSDeployErrorToConsole();
                throw Error(error.message);
            }
            finally {
                this.ResetMsdeployEnvPath();
                if (applyFileTransformFlag) {
                    this.ResetFileTransformation();
                }
            }
        });
    }
    UpdateDeploymentStatus(isDeploymentSuccess) {
        return __awaiter(this, void 0, void 0, function* () { });
    }
    SetMsdeployEnvPath() {
        return __awaiter(this, void 0, void 0, function* () {
            var msDeployPath = yield msDeployUtility.getMSDeployFullPath();
            var msDeployDirectory = msDeployPath.slice(0, msDeployPath.lastIndexOf('\\') + 1);
            this.origEnvPath = process.env.PATH;
            process.env.PATH = msDeployDirectory + ";" + process.env.PATH;
        });
    }
    ResetMsdeployEnvPath() {
        return __awaiter(this, void 0, void 0, function* () {
            process.env.PATH = this.origEnvPath;
        });
    }
    GetDeployCmdFilePath() {
        var webPackagePath = this.taskParams.Package.getPath();
        var packageDir = path.dirname(webPackagePath);
        return packageUtility.PackageUtility.getPackagePath(packageDir + "\\*.deploy.cmd");
    }
    GetDeployScriptCmdArgs(msDeployPublishingProfile) {
        var deployCmdArgs = " /Y /A:basic \"/U:" + msDeployPublishingProfile.UserName + "\" \"\\\"/P:" + msDeployPublishingProfile.UserPWD
            + "\\\"\" \"\\\"/M:" + "https://" + msDeployPublishingProfile.PublishUrl + "/msdeploy.axd?site=" + msDeployPublishingProfile.WebAppName + "\\\"\"";
        if (msDeployPublishingProfile.TakeAppOfflineFlag) {
            deployCmdArgs += ' -enableRule:AppOffline';
        }
        if (msDeployPublishingProfile.RemoveAdditionalFilesFlag) {
            deployCmdArgs += " -enableRule:DoNotDeleteRule";
        }
        if (this.taskParams.AdditionalArguments) {
            deployCmdArgs += " " + this.taskParams.AdditionalArguments;
        }
        return deployCmdArgs;
    }
    ApplyFileTransformation() {
        return __awaiter(this, void 0, void 0, function* () {
            this.origWebPackage = packageUtility.PackageUtility.getPackagePath(this.taskParams.Package);
            this.modWebPackage = yield FileTransformsUtility_1.FileTransformsUtility.applyTransformations(this.origWebPackage, this.taskParams);
            this.bakWebPackage = this.origWebPackage + ".bak";
            fs.renameSync(this.origWebPackage, this.bakWebPackage);
            fs.renameSync(this.modWebPackage, this.origWebPackage);
        });
    }
    ResetFileTransformation() {
        tl.rmRF(this.origWebPackage);
        fs.renameSync(this.bakWebPackage, this.origWebPackage);
    }
}
exports.PublishProfileWebAppDeploymentProvider = PublishProfileWebAppDeploymentProvider;
