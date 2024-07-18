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
exports.addReleaseAnnotation = void 0;
const tl = require("azure-pipelines-task-lib/task");
const azure_arm_appinsights_1 = require("azure-pipelines-tasks-azure-arm-rest/azure-arm-appinsights");
var uuidV4 = require("uuid/v4");
function addReleaseAnnotation(endpoint, azureAppService, isDeploymentSuccess) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            var appSettings = yield azureAppService.getApplicationSettings();
            var instrumentationKey = appSettings && appSettings.properties && appSettings.properties.APPINSIGHTS_INSTRUMENTATIONKEY;
            if (instrumentationKey) {
                let appinsightsResources = new azure_arm_appinsights_1.ApplicationInsightsResources(endpoint);
                var appInsightsResources = yield appinsightsResources.list(null, [`$filter=InstrumentationKey eq '${instrumentationKey}'`]);
                if (appInsightsResources.length > 0) {
                    var appInsights = new azure_arm_appinsights_1.AzureApplicationInsights(endpoint, appInsightsResources[0].id.split('/')[4], appInsightsResources[0].name);
                    var releaseAnnotationData = getReleaseAnnotation(isDeploymentSuccess);
                    yield appInsights.addReleaseAnnotation(releaseAnnotationData);
                    console.log(tl.loc("SuccessfullyAddedReleaseAnnotation", appInsightsResources[0].name));
                }
                else {
                    tl.debug(`Unable to find Application Insights resource with Instrumentation key ${instrumentationKey}. Skipping adding release annotation.`);
                }
            }
            else {
                tl.debug(`Application Insights is not configured for the App Service. Skipping adding release annotation.`);
            }
        }
        catch (error) {
            console.log(tl.loc("FailedAddingReleaseAnnotation", error));
        }
    });
}
exports.addReleaseAnnotation = addReleaseAnnotation;
function getReleaseAnnotation(isDeploymentSuccess) {
    let annotationName = "Release Annotation";
    let releaseUri = tl.getVariable("Release.ReleaseUri");
    let buildUri = tl.getVariable("Build.BuildUri");
    if (!!releaseUri) {
        annotationName = `${tl.getVariable("Release.DefinitionName")} - ${tl.getVariable("Release.ReleaseName")}`;
    }
    else if (!!buildUri) {
        annotationName = `${tl.getVariable("Build.DefinitionName")} - ${tl.getVariable("Build.BuildNumber")}`;
    }
    let releaseAnnotationProperties = {
        "Label": isDeploymentSuccess ? "Success" : "Error",
        "Deployment Uri": getDeploymentUri(),
        "BuildNumber": getPipelineVariable("Build.BuildNumber"),
        "BuildRepositoryName": getPipelineVariable("Build.Repository.Name"),
        "BuildRepositoryProvider": getPipelineVariable("Build.Repository.Provider"),
        "SourceBranch": getPipelineVariable("Build.SourceBranch"),
        "ReleaseId": getPipelineVariable("Release.ReleaseId"),
        "ReleaseDescription": getPipelineVariable("Release.ReleaseDescription"),
        "ReleaseDefinitionName": getPipelineVariable("Release.DefinitionName"),
        "ReleaseEnvironmentName": getPipelineVariable("Release.EnvironmentName"),
        "ReleaseRequestedFor": getPipelineVariable("Release.RequestedForId") || getPipelineVariable("Release.RequestedFor")
    };
    let releaseAnnotation = {
        "AnnotationName": annotationName,
        "Category": "Deployment",
        "EventTime": new Date(),
        "Id": uuidV4(),
        "Properties": JSON.stringify(releaseAnnotationProperties)
    };
    return releaseAnnotation;
}
function getDeploymentUri() {
    let buildUri = tl.getVariable("Build.BuildUri");
    let releaseWebUrl = tl.getVariable("Release.ReleaseWebUrl");
    let collectionUrl = tl.getVariable('System.TeamFoundationCollectionUri');
    let teamProject = tl.getVariable('System.TeamProjectId');
    let buildId = tl.getVariable('build.buildId');
    if (!!releaseWebUrl) {
        return releaseWebUrl;
    }
    if (!!buildUri) {
        return `${collectionUrl}${teamProject}/_build?buildId=${buildId}&_a=summary`;
    }
    return "";
}
function getPipelineVariable(variableName) {
    let variable = tl.getVariable(variableName);
    //we dont want to set a variable to be empty string
    return !!variable ? variable : undefined;
}
