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
exports.FileTransformsUtility = void 0;
const tl = require("azure-pipelines-task-lib/task");
const ParameterParserUtility_1 = require("azure-pipelines-tasks-webdeployment-common/ParameterParserUtility");
var deployUtility = require('azure-pipelines-tasks-webdeployment-common/utility.js');
var fileTransformationsUtility = require('azure-pipelines-tasks-webdeployment-common/fileTransformationsUtility.js');
var generateWebConfigUtil = require('azure-pipelines-tasks-webdeployment-common/webconfigutil.js');
class FileTransformsUtility {
    static applyTransformations(webPackage, taskParams) {
        return __awaiter(this, void 0, void 0, function* () {
            tl.debug("WebConfigParameters is " + taskParams.WebConfigParameters);
            var applyFileTransformFlag = taskParams.JSONFiles.length != 0 || taskParams.XmlTransformation || taskParams.XmlVariableSubstitution;
            if (applyFileTransformFlag || taskParams.WebConfigParameters) {
                var isFolderBasedDeployment = tl.stats(webPackage).isDirectory();
                var folderPath = yield deployUtility.generateTemporaryFolderForDeployment(isFolderBasedDeployment, webPackage, taskParams.Package.getPackageType());
                if (taskParams.WebConfigParameters) {
                    tl.debug('parsing web.config parameters');
                    var webConfigParameters = ParameterParserUtility_1.parse(taskParams.WebConfigParameters);
                    generateWebConfigUtil.addWebConfigFile(folderPath, webConfigParameters, this.rootDirectoryPath);
                }
                if (applyFileTransformFlag) {
                    var isMSBuildPackage = !isFolderBasedDeployment && (yield deployUtility.isMSDeployPackage(webPackage));
                    fileTransformationsUtility.fileTransformations(isFolderBasedDeployment, taskParams.JSONFiles, taskParams.XmlTransformation, taskParams.XmlVariableSubstitution, folderPath, isMSBuildPackage);
                }
                var output = yield deployUtility.archiveFolderForDeployment(isFolderBasedDeployment, folderPath);
                webPackage = output.webDeployPkg;
            }
            else {
                tl.debug('File Tranformation not enabled');
            }
            return webPackage;
        });
    }
}
exports.FileTransformsUtility = FileTransformsUtility;
FileTransformsUtility.rootDirectoryPath = "D:\\home\\site\\wwwroot";
