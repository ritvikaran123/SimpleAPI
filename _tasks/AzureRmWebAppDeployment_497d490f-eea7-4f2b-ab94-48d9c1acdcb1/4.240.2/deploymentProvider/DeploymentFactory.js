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
exports.DeploymentFactory = void 0;
const TaskParameters_1 = require("../operations/TaskParameters");
const Constant = require("../operations/Constants");
const PublishProfileWebAppDeploymentProvider_1 = require("./PublishProfileWebAppDeploymentProvider");
const BuiltInLinuxWebAppDeploymentProvider_1 = require("./BuiltInLinuxWebAppDeploymentProvider");
const WindowsWebAppWebDeployProvider_1 = require("./WindowsWebAppWebDeployProvider");
const WindowsWebAppZipDeployProvider_1 = require("./WindowsWebAppZipDeployProvider");
const WindowsWebAppRunFromZipProvider_1 = require("./WindowsWebAppRunFromZipProvider");
const ContainerWebAppDeploymentProvider_1 = require("./ContainerWebAppDeploymentProvider");
const tl = require("azure-pipelines-task-lib/task");
const packageUtility_1 = require("azure-pipelines-tasks-webdeployment-common/packageUtility");
const WindowsWebAppWarDeployProvider_1 = require("./WindowsWebAppWarDeployProvider");
class DeploymentFactory {
    constructor(taskParams) {
        this._taskParams = taskParams;
    }
    GetDeploymentProvider() {
        return __awaiter(this, void 0, void 0, function* () {
            switch (this._taskParams.ConnectionType) {
                case Constant.ConnectionType.PublishProfile:
                    return new PublishProfileWebAppDeploymentProvider_1.PublishProfileWebAppDeploymentProvider(this._taskParams);
                case Constant.ConnectionType.AzureRM:
                    if (this._taskParams.isLinuxApp) {
                        tl.debug("Depolyment started for linux app service");
                        return yield this._getLinuxDeploymentProvider();
                    }
                    if (this._taskParams.isHyperVContainerApp) {
                        tl.debug("Depolyment started for hyperV container app service");
                        return yield this._getContainerDeploymentProvider();
                    }
                    else {
                        tl.debug("Depolyment started for windows app service");
                        return yield this._getWindowsDeploymentProvider();
                    }
                default:
                    throw new Error(tl.loc('InvalidConnectionType'));
            }
        });
    }
    _getLinuxDeploymentProvider() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this._taskParams.isBuiltinLinuxWebApp) {
                return new BuiltInLinuxWebAppDeploymentProvider_1.BuiltInLinuxWebAppDeploymentProvider(this._taskParams);
            }
            else if (this._taskParams.isContainerWebApp) {
                return new ContainerWebAppDeploymentProvider_1.ContainerWebAppDeploymentProvider(this._taskParams);
            }
            else {
                throw new Error(tl.loc('InvalidImageSourceType'));
            }
        });
    }
    _getContainerDeploymentProvider() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this._taskParams.isHyperVContainerApp) {
                return new ContainerWebAppDeploymentProvider_1.ContainerWebAppDeploymentProvider(this._taskParams);
            }
            else {
                throw new Error(tl.loc('InvalidImageSourceType'));
            }
        });
    }
    _getWindowsDeploymentProvider() {
        return __awaiter(this, void 0, void 0, function* () {
            tl.debug("Package type of deployment is: " + this._taskParams.Package.getPackageType());
            switch (this._taskParams.Package.getPackageType()) {
                case packageUtility_1.PackageType.war:
                    return new WindowsWebAppWarDeployProvider_1.WindowsWebAppWarDeployProvider(this._taskParams);
                case packageUtility_1.PackageType.jar:
                    return new WindowsWebAppZipDeployProvider_1.WindowsWebAppZipDeployProvider(this._taskParams);
                default:
                    return yield this._getWindowsDeploymentProviderForZipAndFolderPackageType();
            }
        });
    }
    _getWindowsDeploymentProviderForZipAndFolderPackageType() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this._taskParams.UseWebDeploy) {
                return yield this._getUserSelectedDeploymentProviderForWindow();
            }
            else {
                var _isMSBuildPackage = yield this._taskParams.Package.isMSBuildPackage();
                if (_isMSBuildPackage || this._taskParams.VirtualApplication) {
                    return new WindowsWebAppWebDeployProvider_1.WindowsWebAppWebDeployProvider(this._taskParams);
                }
                else if (this._taskParams.ScriptType) {
                    return new WindowsWebAppZipDeployProvider_1.WindowsWebAppZipDeployProvider(this._taskParams);
                }
                else {
                    return new WindowsWebAppRunFromZipProvider_1.WindowsWebAppRunFromZipProvider(this._taskParams);
                }
            }
        });
    }
    _getUserSelectedDeploymentProviderForWindow() {
        return __awaiter(this, void 0, void 0, function* () {
            switch (this._taskParams.DeploymentType) {
                case TaskParameters_1.DeploymentType.webDeploy:
                    return new WindowsWebAppWebDeployProvider_1.WindowsWebAppWebDeployProvider(this._taskParams);
                case TaskParameters_1.DeploymentType.zipDeploy:
                    return new WindowsWebAppZipDeployProvider_1.WindowsWebAppZipDeployProvider(this._taskParams);
                case TaskParameters_1.DeploymentType.runFromZip:
                    return new WindowsWebAppRunFromZipProvider_1.WindowsWebAppRunFromZipProvider(this._taskParams);
            }
        });
    }
}
exports.DeploymentFactory = DeploymentFactory;
