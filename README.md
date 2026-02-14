# FocusTubes 

## Basic Details

**Team Name:** The Core  

---

## Team Members

- **Rose Seby** – Christ College of Engineering, Irinjalakuda  
*(Solo Participant)*

---

## Hosted Project Link

GitHub Repository:  
https://github.com/rosesebyk/focustube  

---

## Project Description

FocusTubes is a Chrome extension that transforms YouTube into a distraction-free learning platform. It filters video recommendations based on the user’s current task and highlights relevant content while hiding distractions.

---

## The Problem Statement

Students often open YouTube for studying but get distracted by unrelated recommended videos. YouTube’s algorithm prioritizes engagement and watch time rather than productivity and focused learning.

---

## The Solution

FocusTubes allows users to define what they are working on. The extension dynamically scans YouTube video titles and filters content in real time. Relevant videos are highlighted, and unrelated videos are hidden based on the selected strictness level. A built-in Pomodoro timer further supports structured focus sessions.

---

## Technical Details

### Technologies / Components Used


**Languages used:**
- HTML  
- CSS  
- JavaScript  

**Frameworks used:**
- Chrome Extension Manifest V3  

**Libraries used:**
- Chrome Storage API  
- Native DOM APIs  

**Tools used:**
- VS Code  
- Git  
- GitHub  
- Chrome Developer Tools  

Optional:
- Gemini API (for AI-powered semantic filtering)

---

## Features

Feature 1: Task-based YouTube filtering  
Feature 2: Adjustable strictness levels (Low / Medium / High)  
Feature 3: Real-time DOM manipulation  
Feature 4: Built-in Pomodoro timer  
Feature 5: Optional AI-based semantic filtering  

---

## Implementation

### For Software

#### Installation

1. Download or clone this repository.
2. Open Google Chrome and navigate to:
Chrome://extensions


3. Enable **Developer Mode** (top-right corner).
4. Click **Load Unpacked**.
5. Select the folder containing `manifest.json`.

---

#### Run

No backend server is required.  
The extension runs directly inside the browser.

---

## Project Documentation

### Screenshots

https://drive.google.com/file/d/1AAm1ZfSQQJSh0fsKa1bhwSe91waYebUA/view?usp=share_link  
*Popup interface for entering focus task and strictness level.*

https://drive.google.com/file/d/1AAm1ZfSQQJSh0fsKa1bhwSe91waYebUA/view?usp=sharing 
*Filtered YouTube homepage highlighting relevant videos.*

https://drive.google.com/file/d/1xuxljaYe1ZqROxM0HSJkRu-ZpfBALAL9/view?usp=sharing 
*Pomodoro timer integrated into the extension.*

---

## Diagrams
![alt text](<Screenshot 2026-02-13 at 6.37.52 PM.png>)

### System Architecture

User Input (Popup)  
→ Chrome Storage API  
→ Content Script  
→ YouTube DOM Filtering  

**Explanation:**  
User inputs focus details in the popup. These settings are stored using Chrome storage. The content script retrieves this data and dynamically modifies the YouTube DOM to filter and highlight videos in real time.

---

### Application Workflow

1. User enters current task  
2. Settings saved in browser storage  
3. User opens YouTube  
4. Content script activates automatically  
5. Video titles scanned for relevance  
6. Relevant content highlighted  
7. Unrelated content hidden  

---

## Project Demo

Demo Video Link:  
https://drive.google.com/file/d/1chn7besq0e5fWW9YPiMcwajW7gOahJEC/view?usp=share_link 

The demo demonstrates:
- Setting a focus task  
- Filtering YouTube recommendations  
- Adjusting strictness levels  
- Using the Pomodoro timer  

---

## AI Tools Used (Optional – Transparency)

**Tool Used:** ChatGPT  

**Purpose:**
- Documentation assistance  
- Debugging support  
- Architecture clarification  

**Percentage of AI-generated code:** Approximately 50%

**Human Contributions:**
- Extension architecture design  
- Content filtering logic  
- UI implementation  
- Testing and refinement  

---

## Team Contributions

**Rose Seby:**
- Project architecture and design  
- Frontend development  
- Content script implementation  
- Testing and debugging  
- Documentation and demo preparation  

---

## License

This project is licensed under the MIT License.

