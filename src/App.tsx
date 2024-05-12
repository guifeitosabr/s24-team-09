import React, { useState, useEffect } from "react";
import "./App.css";
import Hello from "./components/Hello";
import data from './example.json';

function App() {
  const [openDropdown, setOpenDropdown] = useState(null); // Track which dropdown is open
  const [makingGroup, setMakingGroup] = useState(false);
  const [allTabs, setAllTabs] = useState<{title: string | undefined; url: string | undefined, selected: boolean | undefined}[]>([]);
  const [groupName, setGroupName] = useState("");

  const toggleDropdown = (index) => {
    setOpenDropdown(openDropdown === index ? null : index);
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
    var groupTabs = [];
    for (let i = 0; i < allTabs.length; i += 1) {
      if (allTabs[i].selected) {
        groupTabs.push({title: allTabs[i].title, url: allTabs[i].url});
      }
    }
    createTabGroup(groupName);
    writeTabsToGroup(groupName, groupTabs);
    cancelGroup();
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

  const handleGroupNameChange = (group) => {
    setGroupName(group.target.value);
  }

  return (
    <div className="App">
      <h1>Focus Tabs</h1>
      <ul>
        {data.groups.map((group, index) => (
          <li key={index}>
            <div className="dropdown">
              <button onClick={() => toggleDropdown(index)} className="dropbtn">{group.name}</button>
              <div className={openDropdown === index ? "dropdown-content show" : "dropdown-content"}>
                {group.tabs.map((link, j) => (
                  <a key={j} href={link.url}>{link.title}</a>
                ))}
              </div>
            </div>
          </li>
        ))}
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
        <button onClick={() => getAllTabs()} className="addbtn">{"Add New Qroup"}</button>
      }
    </div>
  );
}

export default App;
