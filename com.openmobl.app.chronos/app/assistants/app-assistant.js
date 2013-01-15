/*
    The contents of this file are subject to the Mozilla Public License
    Version 1.1 (the "License"); you may not use this file except in
    compliance with the License. You may obtain a copy of the License at
    http://www.mozilla.org/MPL/

    Software distributed under the License is distributed on an "AS IS"
    basis, WITHOUT WARRANTY OF ANY KIND, either express or implied. See the
    License for the specific language governing rights and limitations
    under the License.

    The Original Code is OpenMobl Systems code.

    The Initial Developer of the Original Code is OpenMobl Systems.
    Portions created by OpenMobl Systems are Copyright (C) 2010-2011
    OpenMobl Systems. All Rights Reserved.

    Contributor(s):
        OpenMobl Systems
        Donald C. Kirker <donald.kirker@openmobl.com>

    Alternatively, the contents of this file may be used under the terms
    of the GNU General Public License Version 2 license (the  "GPL"), in
    which case the provisions of GPL License are applicable instead of
    those above. If you wish to allow use of your version of this file only
    under the terms of the GPL License and not to allow others to use
    your version of this file under the MPL, indicate your decision by
    deleting the provisions above and replace them with the notice and
    other provisions required by the GPL License. If you do not delete
    the provisions above, a recipient may use your version of this file
    under either the MPL or the GPL License.
 */

Chronos = {};

function AppAssistant()
{
    Mojo.Log.info("AppAssistant#new");
    
    Chronos = this;

    this.identified = false;
    
    this.mainStageName = "main";
    this.mainSceneName = "main";
    this.altStageName = "alt";
    this.altSceneName = "mainstart";
    this.aboutSceneName = "about";
    this.supportSceneName = "appsupportinfo";
    this.helpSceneName = "help";
    
    this.prefsManager = undefined;
}

AppAssistant.prototype.setup = function()
{
    Mojo.Log.info("AppAssistant#setup");
	/*
	This function is for setup tasks that have to happen when the app is first created.
	This should be used to intialize any application-level data structures.
	*/
    
    this.prefsManager = new PrefsManager();
};

AppAssistant.prototype.getPrefsManager = function() { return this.prefsManager; };

AppAssistant.prototype.getActiveStageController = function()
{
    var stageController = this.controller.getStageController(this.mainStageName);
    
    return stageController;
};

AppAssistant.prototype.launchSceneInMainCard = function(stageName, sceneName, type, params)
{
    var stageController = this.controller.getStageProxy(stageName);
	if (stageController) {
		stageController.pushScene(sceneName, params);
	} else {
        var that = this;
        var stageProp = {
                    name: stageName,
                    lightweight: true,
                };
        
        if (type === Mojo.Controller.StageType.dashboard) {
            stageProp.noWindow = true;
            stageProp.icon = "icon-dash.png";
        }
        
        this.controller.createStageWithCallback(stageProp,
                function(stageController) {
                    stageController.pushScene(sceneName, params);
                },
                type);
    }
};
AppAssistant.prototype.closeAltStage = function()
{
    var stageController = this.controller.closeStage(this.altStageName);
};

AppAssistant.prototype.launchAbout = function(params)
{
    this.launchSceneInMainCard(this.altStageName, this.aboutSceneName, Mojo.Controller.StageType.card, params);
};

AppAssistant.prototype.considerForNotification = function(notificationData)
{
	/*
	This function is called if all other notification commanders do not
	process a particular sendToNotification call. The assistant may perform
	any default processing here if desired.
	*/
};

AppAssistant.prototype.handleLaunch = function(params)
{
    Mojo.Log.info("AppAssistant#handleLaunch");
	/*
	This function is called after the application has launched by the user or
	the applicationManager service. This may be called while the app is already
	running.

	This function should handle any application-defined commands stored in the
	params field and launch the main stage, if necessary.
	*/

    Mojo.Log.info("Launched with params: ", Object.toJSON(params));

    //this.launchSceneInMainCard(this.mainStageName, this.mainSceneName, params);
    this.launchSceneInMainCard(this.altStageName, this.altSceneName, Mojo.Controller.StageType.card, {});
    this.launchSceneInMainCard(this.mainStageName, this.mainSceneName, Mojo.Controller.StageType.dashboard, params);
};

AppAssistant.prototype.handleCommand = function(event)
{
    //this.menuAssistant.handleCommand(event);
};

AppAssistant.prototype.cleanup = function()
{

};
