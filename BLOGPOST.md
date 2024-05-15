# Post Morterm Analysis

Developing FocusTabs has been an enlightening journey filled with challenges, decisions, and ultimately, valuable lessons. In this post-mortem analysis, we'll delve into the process, decisions made, mistakes encountered, and most importantly, the lessons learned throughout the development of the project.

## Decisions and Mistakes

### 1. Underestimating API Integration Complexity

One of our early mistakes was underestimating the complexity of integrating multiple APIs, especially the OpenAI API for automated tab grouping suggestions. Our initial timeline did not adequately account for the time required to understand, experiment with, and troubleshoot API integrations. This led to delays in implementing crucial functionality and necessitated adjustments to our timeline. For instance, we had to deal with collecting the user’s API key as we could not use a global API key for all consumers. To account for this, if an API key was not stored in the application, we prompt the user to enter one they have created from the Open AI website. However, we ran into some issues storing this on the device and being able to then use the API key for calls to GPT to obtain tab grouping recommendations. Additionally, we encountered issues with obtaining accurate grouping answers from the GPT as sometimes the answers were null or completely inaccurate. Our solution to this issue came primarily from adapting the prompt message to address certain edge cases and ensure GPT completely understood the task. We also tested entering different types of information about the websites into GPT and discovered the website titles were the most information while not overloading too much unnecessary information.

### 2. Feature Overload

In our enthusiasm to cater to diverse user needs, we initially planned an extensive feature set. However, as development progressed, we realized the danger of feature overload. Some features, while innovative, detracted from the core functionality of tab grouping and added unnecessary complexity. Deciding to streamline our feature set was a tough but necessary decision to ensure a focused and user-centric product. For instance, we initially planned on storing user login information for websites that required it so that the user was automatically logged into the website when a tab group was opened thereby streamlining the user experience. However, after implementing the core functionality and the automated tab grouping suggestions using the OpenAI API, including this feature was too much to handle and thereby could not be developed. Another feature we planned to add, but later scrapped was the use of tab analytics to figure out tabs that users frequently spent time on or tabs that were often open in conjunction as part of the suggested tab group feature. However, we decided to just confine these suggestions to encompass tabs that the user had already added to some group before (and thus thought of as important), as this was far more feasible to implement, and would not result in the installation crashing or running extremely slowly if the user had many tabs (say 50-60) open at once. 

### 3. UI/UX Trade-offs

Balancing functionality with a clean and intuitive user interface proved challenging at times. We had to make difficult decisions regarding UI/UX trade-offs, especially when accommodating diverse user preferences and device constraints. Striking the right balance between feature richness and simplicity required constant iteration and feedback gathering, but ultimately led to a more user-friendly experience. The final UI was extremely clean and showed the user the currently available tab groups, with an X to remove groups that are no longer needed, a button to manually add a tab group, and a button to automatically group tabs with AI. To manually create tab groups, after much deliberation, we decided to let the user enter the name of the group and then simply click on the tabs they wanted to include in the group from the list of all available tabs. This allowed the user to easily add/remove tabs from the group. The AI suggestion component was extremely simple as it prompted the user to enter their Open AI API key if one was not stored and then simply presented a suggested tab grouping which they could implement by clicking a button. Finally, at all stages, the user could cancel an ongoing operation. This setup strikes the perfect balance between simple, easy-to-understand UI with complex functionality and complete user control.

### 4. Chrome Extension Limitation

The limitations of a Chrome extension were initially a large issue. For the background.js script, we had originally referenced some other scripts that utilized 3rd party libraries (OpenAI, Cheerio, Axios, etc.) but we realized that we would not be able to use these as imports in our extension, which necessitated changing a lot of our initial ideas. For example, when figuring out what information for each tab to provide to the OpenAI API as context for determining what tab groups to create, we initially thought to provide content from the tabs themselves, though we later had to reduce this to just information from the tab’s title, as this was all the information we could access without requesting Axios. 

### 5. Formatting Output

We also ran into many issues regarding the formatting of function output. Since we had many functions that relied on each other, including many that were asynchronous, much of our debugging was realizing that we had to return a subset of the original output when passing it to another function or resolve the output so that we weren’t passing in a Promise as the input. However, as we became more familiar with the syntax, we became far more comfortable with avoiding these types of issues. 

### 6. Interfacing

Finally, an issue we faced was understanding how to interface with the extension when downloaded. We primarily relied on print statements to debug, and thus needed to figure out how to parse the Chrome development tools to figure out where these were displayed (in particular, figuring out where our frontend typescript file’s print statements were sent to required quite a bit of effort before we landed on right-clicking on the extension pop-up).


## Lessons Learned

### 1. Innovation and Pivoting

The first and most important lesson we learned was innovation and pivoting. After going past the ideation phase, while planning on how to develop the extension, we realized that Google Chrome already had a tab grouping feature potentially making our extension redundant. We decided to stick with our idea but set out to make a tab grouper with superior UI that made it easier for the user to navigate. Our main edge over other tab grouping extensions is our automatic grouping feature that allows users to group tabs quickly with just a click of a button. This addition not only differentiated our extension but also aligned with our vision of enhancing productivity through intelligent solutions. We learned the importance of adaptability and creativity in navigating unforeseen challenges, ultimately leading to a more innovative and impactful product.

### 2. Flexibility in Feature Selection

Our initial feature set was ambitious, aiming to cater to a wide array of user stories. However, as development progressed, we realized the need to prioritize essential features and streamline our focus. Some features, while intriguing, were not feasible within our timeframe or added unnecessary complexity. Specifically, we initially thought of having an analytics feature that allows users to examine your overall time spent on tabs. That feature would have been a separate project on its own and we decided to keep things simple. Learning to prioritize and be flexible with feature selection was crucial in delivering a functional and user-friendly extension.

### 3. Embracing Failure as Learning

Throughout the development process, we encountered setbacks, bugs, and unforeseen challenges. However, instead of viewing these as failures, we embraced them as opportunities for learning and growth. Each bug fixed, and each challenge overcome, contributed to our collective knowledge, and strengthened our resolve to deliver a polished product. We outlined some of these specific specific issues in the decisions and mistakes section.


## Conclusion

The journey of developing FocusTabs has been both rewarding and enlightening. From understanding user needs to embracing failure as learning, every step taught us valuable lessons that will undoubtedly shape our future endeavors. While there were challenges and mistakes along the way, the collective effort of our team and our commitment to delivering a high-quality product prevailed. As we reflect on this journey, we look forward to applying these lessons in future projects and continuing to innovate in the realm of productivity-enhancing tools.

