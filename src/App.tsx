import React, { useState, useEffect } from "react";
import "./App.css";
import Hello from "./components/Hello";

function App() {
  return (
    <div className="App">
      <h1>Extension Name</h1>
      {/* Render the SnippetList component with the snippets and event handlers */}
      <Hello person="Wod" />
    </div>
  );
}

export default App;
