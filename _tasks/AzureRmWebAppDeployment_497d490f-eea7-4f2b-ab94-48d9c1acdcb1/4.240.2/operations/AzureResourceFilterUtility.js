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
exports.AzureResourceFilterUtility = void 0;
const tl = require("azure-pipelines-task-lib/task");
const azure_arm_resource_1 = require("azure-pipelines-tasks-azure-arm-rest/azure-arm-resource");
class AzureResourceFilterUtility {
    static getResourceGroupName(endpoint, resourceName) {
        return __awaiter(this, void 0, void 0, function* () {
            const azureResources = new azure_arm_resource_1.Resources(endpoint);
            const resources = yield azureResources.getResources('Microsoft.Web/Sites', resourceName);
            const resourceGroupIds = [...new Set(resources.map(r => r.id))];
            if (!resourceGroupIds || resourceGroupIds.length == 0) {
                throw new Error(tl.loc('ResourceDoesntExist', resourceName));
            }
            else if (resourceGroupIds.length > 1) {
                throw new Error(tl.loc('MultipleResourceGroupFoundForAppService', resourceName));
            }
            else {
                return resourceGroupIds[0].split("/")[4];
            }
        });
    }
}
exports.AzureResourceFilterUtility = AzureResourceFilterUtility;
