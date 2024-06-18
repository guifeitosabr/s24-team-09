import React, { useState, useEffect } from "react";
import "./App.css";

interface Tab {
  title: string | undefined;
  url: string | undefined;
}

interface TabGroup {
  groupName: string | undefined;
  tabs: Tab[];
}

function callBackgroundFunction(action, data) {
  return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({ action, data }, response => {
          if (chrome.runtime.lastError) {
              console.error("Background Error:", chrome.runtime.lastError.message);
              reject(chrome.runtime.lastError);
          } else {
              resolve(response);
          }
      });
  });
}

function App() {
  const [showAPIKeyAlert, setShowAPIKeyAlert] = useState(false);
  const [showAPIKeyPrompt, setShowAPIKeyPrompt] = useState(false);
  const [showAPIKeyStoredMessage, setShowAPIKeyStoredMessage] = useState(false);
  const [showAPIKeyUsedMessage, setShowAPIKeyUsedMessage] = useState(false);
  const [groupSource, setGroupSource] = useState(null);
  const [showGroupOptions, setShowGroupOptions] = useState(false);
  const [openDropdown, setOpenDropdown] = useState(null);
  const [makingGroup, setMakingGroup] = useState(false);
  const [allTabs, setAllTabs] = useState<{title: string | undefined; url: string | undefined, selected: boolean | undefined}[]>([]);
  const [groupName, setGroupName] = useState("");
  const [groupTabs, setGroupTabs] = useState<Tab[]>([]);
  const [tabGroups, setTabGroups] = useState([]);
  const [aiGrouping, setAIGrouping] = useState([]);
  const [APIKey, setAPIKey] = useState('');
  const [tempAPIKey, setTempAPIKey] = useState('');

  useEffect(() => {
    getCurrentTabGroups();
  }, []); 

  const toggleDropdown = (index) => {
    setOpenDropdown(prevOpenDropdown => prevOpenDropdown === index ? null : index);
  };

  const handleShowGroupOptions = () => {
    setShowGroupOptions(!showGroupOptions);
  };

  const storeAPIKeyAndProceed = () => {
    setAPIKey(tempAPIKey);
    setShowAPIKeyStoredMessage(true);
    setShowAPIKeyPrompt(false);
  };

  const validateAPIKey = async (apiKey) => {
    try {
      const response = await fetch("https://api.openai.com/v1/engines", {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`
        }
      });
      
      if (response.ok) {
        console.log("API Key is valid.");
        return true;
      } else {
        console.error("Invalid API Key.");
        return false;
      }
    } catch (error) {
      console.error("Error validating API Key:", error);
      return false;
    }
  };
  
  const handleAPIKeySubmit = async () => {
    const isValid = await validateAPIKey(tempAPIKey);
    if (isValid) {
      setAPIKey(tempAPIKey);
      setShowAPIKeyStoredMessage(true);
      (storeAPIKeyAndProceed);
    } else {
      setShowAPIKeyAlert(true);
      setTimeout(() => {
        setShowAPIKeyAlert(false);
    }, 5000);
    }
  };

  async function makeAIGrouping(openTabs) {
    if (openTabs) {
      try {
        const groups = await callBackgroundFunction('getSuggestedOpenTabs', {});
        setAIGrouping(groups.result);
      } catch (error) {
        console.error('Error getting AI group suggestions for open tabs:', error);
      }
    } else {
      try {
        const groups = await callBackgroundFunction('getSuggestedTabGroups', {});
        setAIGrouping(groups.result);
      } catch (error) {
        console.error('Error getting AI group suggestions for existing groups:', error);
      }
    }
  };

  const initiateGroupingProcess = (groupSource) => {
    if (APIKey) {
        if (groupSource) {
            makeAIGrouping(true);
        } else {
            makeAIGrouping(false);
        }
        setShowAPIKeyStoredMessage(false);
        setShowAPIKeyUsedMessage(true);
        setTimeout(() => {
            setShowAPIKeyUsedMessage(false);
            // setAPIKey('');
        }, 5000);
    } else {
      setShowAPIKeyPrompt(true);
      setTimeout(() => setShowAPIKeyPrompt(false), 5000);
      console.error("API Key is not set.");
    }
  };

  const getAllTabs = () => {
    setMakingGroup(true);
    chrome.tabs.query({}, function(tabs) {
      tabs.forEach(tab => {
        const newTab = {title: tab.title, url: tab.url, selected: false};
        setAllTabs(allTabs => [...allTabs, newTab]);
      });
    });
  };

  const cancelGroup = () => {
    setMakingGroup(false);
    setAllTabs([]);
    setGroupName("");
    setAIGrouping([]);
  };

  const addGroup = () => {
    const selectedTabs = allTabs.filter(tab => tab.selected);
    callBackgroundFunction('writeTabsToGroup', { groupName: groupName, tabObjects: selectedTabs })
      .then(() => {
        cancelGroup(),
        getCurrentTabGroups()
      });
  };

  const newGroupTabSelected = (tab) => {
    setAllTabs(allTabs => allTabs.map(t => {
      if (t.title === tab.title && t.url === tab.url) {
        return { ...t, selected: !t.selected };
      }
      return t;
    }));
  };

  async function getCurrentTabGroups() {
    const groups = await callBackgroundFunction('getAllGroups', {});
    setTabGroups(groups.result)
  };

  async function saveAIGroups() {
    try {
      await Promise.all(
        aiGrouping.map(group =>
          callBackgroundFunction('createTabGroup', group.groupName)
        )
      );
  
      for (const group of aiGrouping) {
        await callBackgroundFunction('writeTabsToGroup', { groupName: group.groupName, tabObjects: group.tabs });
      }

      cancelGroup();
  
      getCurrentTabGroups();
    } catch (error) {
      console.error('Error saving AI groups:', error);
    }
  };

  async function removeGroup(index) {
    const updatedGroups = tabGroups.filter((_, i) => i !== index);
    setTabGroups(updatedGroups);
  };


  const openTabsInNewWindow = (tabs) => {
    const urls = tabs.map(tab => tab.url);
    chrome.windows.create({ url: urls, focused: true });
  };


  async function storeAPIKey() {
    setAPIKey(tempAPIKey);
  }

  useEffect(() => {
    const updateAPIKeyUsage = async () => {
      if (APIKey) {
        try {
          const result = await callBackgroundFunction('setApiKey', { key: APIKey });
          console.log('Background function called successfully:', result);
        } catch (error) {
          console.error('Error calling background function:', error);
        }
      }
    };
    updateAPIKeyUsage();
  }, [APIKey]);
  

  return (
    <div className="App">
      <link href="https://fonts.googleapis.com/icon?family=Material+Icons" rel="stylesheet"></link>
      <h1 className="title">Focus Tabs</h1>
      {showAPIKeyStoredMessage && <p>Your API Key is stored.</p>}
      {showAPIKeyUsedMessage && <p>Your API Key was used.</p>}
      {showAPIKeyUsedMessage && <p>Please wait a few moments for the AI suggestions.</p>}
      {showAPIKeyPrompt && (!showAPIKeyStoredMessage) && <p>Please enter your OpenAI API Key to proceed with AI grouping.</p>}
      {showAPIKeyAlert && <p>The API Key entered is invalid. Please enter a valid API Key.</p>}
      <ul>
        {tabGroups.length > 0 ? (
          tabGroups.map((group, index) => (
            <li key={index}>
              <div className="dropdown">
                <button onClick={() => {
                  toggleDropdown(index);
                  openTabsInNewWindow(group.tabs);
                }} className="dropbtn">{group.groupName}</button>
                <button onClick={() => removeGroup(index)} className="delete-btn">
                x
                </button>
              </div>
            </li>
          ))
        ) : (
          <li>No tab groups available</li>
        )}
      </ul>
      
      {makingGroup && (
        <div>
          <h2 className="text2">Create Tab Group</h2>
          <input
            type="text"
            value={groupName}
            onChange={e => setGroupName(e.target.value)}
            placeholder="Enter group name"
          />
        </div>
      )}

      <div className="newtabs-container">
        {allTabs.map(tab => {
          return tab.selected && (
            <button onClick={() => newGroupTabSelected(tab)} className="outlineAddTabBtn">
              {tab.title}
            </button>) || 
            !tab.selected && (
              <button onClick={() => newGroupTabSelected(tab)} className="regAddTabBtn">
                {tab.title}
              </button>);
        })}
      </div>

      {(makingGroup) && 
        <div className="button-row">
          <button onClick={() => addGroup()} className="addbtn">{"Add Group"}</button>
          <button onClick={() => cancelGroup()} className="addbtn">{"Cancel Group"}</button>
        </div>
      }

      {!makingGroup && aiGrouping.length == 0 &&
        <div>
          <button onClick={() => getAllTabs()} className="addbtn">{"Manual Tab Grouping"}</button>
          <button onClick={handleShowGroupOptions} className="addbtn">{"AI Tab Grouping"}</button>
          {showGroupOptions && (
            <div>
              <button onClick={() => initiateGroupingProcess(true)} className="smallbtn">Based on Open Tabs</button>
              <button onClick={() => initiateGroupingProcess(false)} className="smallbtn">Based on Existing Groups</button>
            </div>
          )}
        </div>
      }
      
      {APIKey === '' && (showGroupOptions) && (
          <div>
              <h3>Enter OpenAI API Key</h3>
              <input
                  type="text"
                  value={tempAPIKey}
                  onChange={e => setTempAPIKey(e.target.value)}
                  placeholder="Enter API Key"
              />
              <button onClick={handleAPIKeySubmit}>Submit API Key</button>
          </div>
      )}

      {aiGrouping.length > 0 && (APIKey != '') && (
        <div>
          <h2 className="text2">AI Tab Grouping Suggestions</h2>
          <ul>
            {aiGrouping.map((group, index) => (

              <li key={index}>
                <div className="ai-group">
                  <h2 className="text3">{group.groupName}</h2>
                </div>

                {group.tabs.map((tab, j) => (
                  <div className={"ai-group-link"}>
                    <h3 className="text4">{tab.title}</h3>
                  </div>
                ))}
              </li>
            ))}
          </ul>
        </div>
      )}

      {(aiGrouping.length > 0) && (APIKey != '') &&
        <div className="button-row">
          <button onClick={() => saveAIGroups()} className="addbtn">{"Save Groups"}</button>
          <button onClick={() => cancelGroup()} className="addbtn">{"Cancel"}</button>
        </div>
      }

      {(aiGrouping.length > 0) && (APIKey == '') &&
        <div className="button-row">
          <button onClick={() => storeAPIKey()} className="addbtn">{"Load AI Suggestions"}</button>
          <button onClick={() => cancelGroup()} className="addbtn">{"Cancel"}</button>
        </div>
      }
    </div>
  );
}

export default App;