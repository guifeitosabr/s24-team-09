import React, { useState, useEffect } from "react";
import data from './example.json';
import "./App.css";
import Hello from "./components/Hello";

function App() {
  return (
    <div className="App">
      <h1>Focus Tabs</h1>
      {/* Render the SnippetList component with the snippets and event handlers */}
      <Hello person="World" />
      <ul>
        {data.tabs.map((group, index) => (
          <li key={index}>
            <button type="button" className="list-button">
              {group.title}
            </button>
          </li>
        ))}
    </ul>
    </div>
  );
}

export default App;
