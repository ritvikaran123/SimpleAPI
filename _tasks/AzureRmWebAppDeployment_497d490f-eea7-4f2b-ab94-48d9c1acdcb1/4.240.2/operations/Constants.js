"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AzureDeployPackageArtifactAlias = exports.PublishProfileXml = exports.SiteRoot = exports.ConnectionType = void 0;
exports.ConnectionType = {
    PublishProfile: "PublishProfile",
    AzureRM: "AzureRM"
};
exports.SiteRoot = '/site/wwwroot';
exports.PublishProfileXml = {
    ExcludeApp_Data: "ExcludeApp_Data",
    EnableMSDeployAppOffline: "EnableMSDeployAppOffline",
    SkipExtraFilesOnServer: "SkipExtraFilesOnServer",
    SiteUrlToLaunchAfterPublish: "SiteUrlToLaunchAfterPublish",
    MSDeployServiceURL: "MSDeployServiceURL",
    DeployIisAppPath: "DeployIisAppPath",
    MSDeploy: "MSDeploy",
    UserName: "UserName"
};
exports.AzureDeployPackageArtifactAlias = "Azure_App_Service_Deploy_PackageArtifactAlias";
