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
exports.PublishProfileUtility = void 0;
const tl = require("azure-pipelines-task-lib/task");
const fs = require("fs");
const Constant = require("./Constants");
const path = require("path");
const Q = require("q");
var packageUtility = require('azure-pipelines-tasks-webdeployment-common/packageUtility.js');
var parseString = require('xml2js').parseString;
const ERROR_FILE_NAME = "error.txt";
class PublishProfileUtility {
    constructor(publishProfilePath) {
        this._publishProfileJs = null;
        this._publishProfilePath = publishProfilePath;
    }
    GetTaskParametersFromPublishProfileFile(taskParams) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                if (this._publishProfileJs === null) {
                    this._publishProfileJs = yield this.GetPublishProfileJsonFromFile();
                }
            }
            catch (error) {
                throw new Error(error);
            }
            var msDeployPublishingProfile = {
                WebAppName: this._publishProfileJs.DeployIisAppPath[0],
                TakeAppOfflineFlag: this._publishProfileJs.hasOwnProperty(Constant.PublishProfileXml.EnableMSDeployAppOffline) ?
                    this._publishProfileJs.EnableMSDeployAppOffline[0] : false,
                RemoveAdditionalFilesFlag: this._publishProfileJs.hasOwnProperty(Constant.PublishProfileXml.SkipExtraFilesOnServer) ?
                    this._publishProfileJs.SkipExtraFilesOnServer[0] : false,
                PublishUrl: this._publishProfileJs.MSDeployServiceURL[0],
                UserName: this._publishProfileJs.UserName[0],
                UserPWD: taskParams.PublishProfilePassword
            };
            return msDeployPublishingProfile;
        });
    }
    GetPropertyValuefromPublishProfile(propertyKey) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                if (this._publishProfileJs === null) {
                    this._publishProfileJs = yield this.GetPublishProfileJsonFromFile();
                }
            }
            catch (error) {
                throw new Error(error);
            }
            return new Promise((response, reject) => {
                this._publishProfileJs.hasOwnProperty(propertyKey) ?
                    response(this._publishProfileJs[propertyKey][0]) : reject(tl.loc('PropertyDoesntExistPublishProfile', propertyKey));
            });
        });
    }
    GetPublishProfileJsonFromFile() {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((response, reject) => {
                var pubxmlFile = packageUtility.PackageUtility.getPackagePath(this._publishProfilePath);
                var publishProfileXML = fs.readFileSync(pubxmlFile);
                parseString(publishProfileXML, (error, result) => {
                    if (!!error) {
                        reject(tl.loc('XmlParsingFailed', error));
                    }
                    var propertyGroup = result && result.Project && result.Project.PropertyGroup ? result.Project.PropertyGroup : null;
                    if (propertyGroup) {
                        for (var index in propertyGroup) {
                            if (propertyGroup[index] && propertyGroup[index].WebPublishMethod[0] === Constant.PublishProfileXml.MSDeploy) {
                                if (!propertyGroup[index].hasOwnProperty(Constant.PublishProfileXml.MSDeployServiceURL)
                                    || !propertyGroup[index].hasOwnProperty(Constant.PublishProfileXml.DeployIisAppPath)
                                    || !propertyGroup[index].hasOwnProperty(Constant.PublishProfileXml.UserName)) {
                                    reject(tl.loc('InvalidPublishProfile'));
                                }
                                tl.debug("Publish Profile: " + JSON.stringify(propertyGroup[index]));
                                response(propertyGroup[index]);
                            }
                        }
                    }
                    reject(tl.loc('ErrorNoSuchDeployingMethodExists'));
                });
            });
        });
    }
    RunCmd(cmdTool, cmdArgs) {
        return __awaiter(this, void 0, void 0, function* () {
            var deferred = Q.defer();
            var cmdError = null;
            var errorFile = path.join(tl.getVariable('System.DefaultWorkingDirectory'), ERROR_FILE_NAME);
            var errObj = fs.createWriteStream(errorFile);
            errObj.on('finish', () => {
                if (cmdError) {
                    deferred.reject(cmdError);
                }
                else {
                    deferred.resolve();
                }
            });
            try {
                yield tl.exec(cmdTool, cmdArgs, {
                    errStream: errObj,
                    outStream: process.stdout,
                    failOnStdErr: true,
                    windowsVerbatimArguments: true,
                    // shell should be true, otherwise see https://github.com/microsoft/azure-pipelines-tasks/issues/17634
                    // workaround https://github.com/nodejs/node/issues/7367#issuecomment-229728704
                    shell: true
                });
            }
            catch (error) {
                cmdError = error;
            }
            finally {
                errObj.end();
            }
            return deferred.promise;
        });
    }
}
exports.PublishProfileUtility = PublishProfileUtility;
