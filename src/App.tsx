import React, { useState, useEffect } from "react";
import "./App.css";
import Hello from "./components/Hello";
import data from './example.json';

function App() {
  const [openDropdown, setOpenDropdown] = useState(null); // Track which dropdown is open
  const toggleDropdown = (index) => {
    if (openDropdown === index) { // If clicking on the currently open dropdown, close it
      setOpenDropdown(null);
    } else {
      setOpenDropdown(index); // Otherwise, open the clicked dropdown
    }
  }
  console.log(toggleDropdown);
  return (
    <div className="App">
      <h1>Focus Tabs</h1>
      <Hello person="World" />
      <ul>
        {data.groups.map((group, index) => (
          <li key={index}>
            <div className="dropdown">
              <button onClick={() => toggleDropdown(index)} className="dropbtn">{group.name}</button>
              <div className={openDropdown === index ? "dropdown-content show" : "dropdown-content"}>
                {group.tabs.map((link, j) => (
                  <a key={j} href={link.url}>{link.title}</a> // Fixed to dynamically display link titles
                ))}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default App;
