# FocusTabs

FocusTabs is a Chrome extension designed to enhance productivity by helping users organize their browsing experience more efficiently. With the ever-growing number of tabs open in our browsers, it's easy to lose track of important information and tasks. FocusTabs aims to solve this problem by allowing users to group tabs based on topics, projects, or any custom category they desire. You can find the landing page for our extension [here](https://focus-tabs.com/) (and the repository associated with it [here](https://github.com/guifeitosabr/s24-team-09-landing-page)) as well as our blog post deliverable [here](https://medium.com/@anirudh2/cis-3500-group-9-blog-post-4130e5e30681). 

## Key Features:
1. Manual Grouping: Users can manually create and manage groups to organize their tabs according to their workflow or interests.
2. Automatic Grouping: Leveraging OpenAI's API, FocusTabs offers an automatic grouping feature that intelligently categorizes tabs based on the keywords found in their title. This saves users time and effort in organizing their tabs, especially when dealing with a large number of open tabs.
3. Customization: Users have the flexibility to rename and delete tab groups to suit their preferences and browsing habits.
4. Performance Optimization: The extension is designed to be lightweight and efficient, minimizing impact on browser performance.

## Installation

### Install From Release

- Download the latest release from the [Releases](https://github.com/guifeitosabr/s24-team-09/releases)
- Unzip the downloaded ZIP file
- Open Chrome and navigate to `chrome://extensions`
- Enable "Developer mode"
- Drag and drop the unzipped folder into the extensions page

### Install From Source

1. Clone the repository:

   ```bash
   git clone https://github.com/guifeitosabr/s24-team-09.git
   ```

2. Install dependencies:

   ```bash
   cd chrome-extension-text-collector
   npm install
   ```

3. Build the extension:

   ```bash
   npm run build
   ```

4. Load the extension in Chrome:

   - Open Chrome and navigate to `chrome://extensions`
   - Enable "Developer mode"
   - Click "Load unpacked" and select the `dist` directory from this project directory.
  


## Team and Acknowledgements
Authors: Anirudh Bharadwaj, Eshan Singhal, Guilherme Feitosa, and Kofi Addae-Sakyi.

Acknowledgments: We would like to thank Professor Jérémie O. Lumbroso for his fundamental mentorship all throughout the development of FocusTabs. We also utilized [this](https://github.com/jlumbroso/chrome-extension-text-collector/tree/main) repository as a starting point for our project.

## Contact
If you would like to report any issues, please, feel free to open an issue [here](https://github.com/guifeitosabr/s24-team-09/issues/new).

