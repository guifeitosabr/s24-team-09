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
  const [groupTabs, setGroupTabs] = useState<{title: string | undefined; url: string | undefined}[]>([]);
  const [tabGroups, setTabGroups] = useState<TabGroup[]>([]);
  const [currentGroupNames, setCurrentGroupNames] = useState<string[]>([]);

  useEffect(() => {
    getCurrentTabGroups();
  }, [currentGroupNames]); 

  const toggleDropdown = (index) => {
    setOpenDropdown(prevOpenDropdown => prevOpenDropdown === index ? null : index);
  }

  const getAllTabs = () => {
    setMakingGroup(!makingGroup);
    chrome.tabs.query({}, function(tabs) {
      tabs.forEach(tab => {
        console.log(tab.title);
        const newTab = {title: tab.title, url: tab.url, selected: false};
        setAllTabs(allTabs => [...allTabs, newTab]);
      });
    });
  }

  const cancelGroup = () => {
    setMakingGroup(!makingGroup);
    setAllTabs([]);
    setGroupName("");
  }

  const addGroup = () => {
    const selectedTabs = allTabs.filter(tab => tab.selected);

    setCurrentGroupNames(prevGroupNames => [...prevGroupNames, groupName]);
    
    callBackgroundFunction('createTabGroup', { name: groupName })
      .then(() => {
        return callBackgroundFunction('writeTabsToGroup', { groupName: groupName, tabObjects: selectedTabs });
      })
      .then(() => {
        cancelGroup();
        getCurrentTabGroups();
      })
      .catch(error => console.error('Error calling background function:', error));
  }

  const newGroupTabSelected = (tab) => {
    setAllTabs(allTabs => allTabs.map(t => {
      // Check if the current tab in the map is the one clicked
      if (t.title === tab.title && t.url === tab.url) {
        // Toggle the selected state of the tab
        return { ...t, selected: !t.selected };
      }
      return t; // Return the tab unchanged if it's not the one clicked
    }));
  }

  const handleGroupNameChange = (event) => {
    setGroupName(event.target.value);
  }

  const getCurrentTabGroups = () => {
    Promise.all(
      currentGroupNames.map(groupName =>
        callBackgroundFunction('readTabsFromGroup', groupName)
      )
    )
      .then(responses => {
        const newTabGroups = responses.map(response => response as TabGroup);
        setTabGroups(newTabGroups);
        console.log(newTabGroups)
      })
      .catch(error => console.error('Error getting current tab groups:', error));
  };

  return (
    <div className="App">
      <h1 className="title">Focus Tabs</h1>
      <ul>
      {tabGroups.length > 0 ? (
        tabGroups.map((group, index) => (
          <li key={index}>
            <div className="dropdown">
              <button onClick={() => toggleDropdown(index)} className="dropbtn">{group.groupName}</button>
              <div className={openDropdown === index ? "dropdown-content show" : "dropdown-content"}>
                {group.tabs.map((link, j) => (
                  <a key={j} href={link.url}>{link.title}</a>
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
            onChange={handleGroupNameChange}
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
      {makingGroup && 
        <div className="button-row">
          <button onClick={() => addGroup()} className="addbtn">{"Add Group"}</button>
          <button onClick={() => cancelGroup()} className="addbtn">{"Cancel Group"}</button>
        </div>
      }
      {!makingGroup && 
        <button onClick={() => getAllTabs()} className="addbtn">{"Add New Group"}</button>
      }
    </div>
  );
}

export default App;
