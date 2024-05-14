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
  console.log('hi');
  return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({ action, data }, response => {
        console.log('hi');
          if (chrome.runtime.lastError) {
              console.error("Background Error:", chrome.runtime.lastError.message);
              reject(chrome.runtime.lastError);
          } else {
              console.log('hello');
              resolve(response);
          }
      });
  });
}

function App() {
  const [openDropdown, setOpenDropdown] = useState(null); // Track which dropdown is open
  const [makingGroup, setMakingGroup] = useState(false);
  const [allTabs, setAllTabs] = useState<{title: string | undefined; url: string | undefined, selected: boolean | undefined}[]>([]);
  const [groupName, setGroupName] = useState("");
  const [groupTabs, setGroupTabs] = useState<Tab[]>([]);
  const [tabGroups, setTabGroups] = useState([]);
  const [aiGrouping, setAIGrouping] = useState<TabGroup[]>([]);

  useEffect(() => {
    getCurrentTabGroups();
  }, []); 

  useEffect(() => {
    console.log("tabGroups", tabGroups)
    console.log("length: ", tabGroups.length);
}, [tabGroups]);

  const toggleDropdown = (index) => {
    setOpenDropdown(prevOpenDropdown => prevOpenDropdown === index ? null : index);
  };

  const getAllTabs = () => {
    setMakingGroup(true);
    chrome.tabs.query({}, function(tabs) {
      tabs.forEach(tab => {
        console.log(tab.title);
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

    // callBackgroundFunction('createTabGroup', groupName)
    //   .then(() => {
    //     callBackgroundFunction('writeTabsToGroup', { groupName: groupName, tabObjects: selectedTabs });
    //   })
    //   .then(() => {
    //     cancelGroup();
    //     getCurrentTabGroups();
    //   })
    //   .catch(error => console.error('Error calling background function:', error));
  };

  const newGroupTabSelected = (tab) => {
    setAllTabs(allTabs => allTabs.map(t => {
      // Check if the current tab in the map is the one clicked
      if (t.title === tab.title && t.url === tab.url) {
        // Toggle the selected state of the tab
        return { ...t, selected: !t.selected };
      }
      return t; // Return the tab unchanged if it's not the one clicked
    }));
  };

  async function getCurrentTabGroups() {
    const groups = await callBackgroundFunction('getAllGroups', {});
    setTabGroups(groups.result)
  };
  
  async function makeAIGrouping() {
    const groups = await callBackgroundFunction('getSuggestedTabGroups', {});
    setAIGrouping(groups.result)
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
  
      getCurrentTabGroups();
    } catch (error) {
      console.error('Error saving AI groups:', error);
    }
  };

  async function removeGroup(index) {
    const updatedGroups = tabGroups.filter((_, i) => i !== index);
    setTabGroups(updatedGroups);
    // const result = await callBackgroundFunction('removeGroup', { groupName: tabGroups[index].groupName })
  };


  const openTabsInNewWindow = (tabs) => {
    // Collect all URLs from the tabs
    const urls = tabs.map(tab => tab.url);
    // Use chrome.windows.create to open all tabs in a new window
    chrome.windows.create({ url: urls, focused: true });
  };

  return (
    <div className="App">
      <link href="https://fonts.googleapis.com/icon?family=Material+Icons" rel="stylesheet"></link>
      <h1 className="title">Focus Tabs</h1>
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
                <div className={openDropdown === index ? "dropdown-content show" : "dropdown-content"}>
                  {group.tabs.map((link, j) => (
                    <a key={j} href={link.url} target="_blank" rel="noopener noreferrer">{link.title}</a>
                  ))}
                </div>
              </div>
            </li>
          ))
        ) : (
          <li>No tab groups available</li>
        )}
      </ul>
      {makingGroup && (
        <div>
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
      {(makingGroup || aiGrouping.length > 0) && 
        <div className="button-row">
          <button onClick={() => addGroup()} className="addbtn">{"Add Group"}</button>
          <button onClick={() => cancelGroup()} className="addbtn">{"Cancel Group"}</button>
        </div>
      }
      {!makingGroup && 
        <div>
          <button onClick={() => getAllTabs()} className="addbtn">{"Add New Group"}</button>
          <button onClick={() => makeAIGrouping()} className="addbtn">{"AI Tab Grouping"}</button>
        </div>
      }
      <ul>
      {aiGrouping.length > 0 && (
        aiGrouping.map((group, index) => (
          <li key={index}>
            <div className="ai-group">
              <h2 className="ai-group-label">{group.groupName}</h2>
              <button key={index} style={{ border: 'none', background: 'none', cursor: 'pointer' }}>
                <i className="material-icons">add</i>
                <i onClick={() => setGroupName(group.groupName || '')}></i>
              </button>
            </div>
            {group.tabs.map((tab, j) => (
                <div className={"ai-group-link"}>
                  <h3 className="ai-group-url">{tab.title}</h3>
                  <button key={j} style={{ border: 'none', background: 'none', cursor: 'pointer' }}>
                    <i className="material-icons">close</i>
                    <i onClick={() => setGroupName(group.groupName || '')}></i>
                  </button>
                </div>
            ))}
          </li>
        ))
      )}
      </ul>
      {(makingGroup || aiGrouping.length > 0) && 
        <div className="button-row">
          <button onClick={() => saveAIGroups()} className="addbtn">{"Save Groups"}</button>
          <button onClick={() => cancelGroup()} className="addbtn">{"Cancel"}</button>
        </div>
      }
    </div>
  );
}

export default App;
