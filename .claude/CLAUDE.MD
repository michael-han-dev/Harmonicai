## Full stack take home project Harmonic.ai (https://www.harmonic.ai/)

## 📏 What are we looking to measure?

These are the questions we (Harmonic) ask internally. The take home project and jam session are geared towards answering the questions below:

- Does the candidate show thoughtful consideration toward the end user’s experience?
- Would we want to work together / are we a good culture and value fit?
- Is the candidate comfortable working in our stack (or can get up to speed quickly)?
- Is the problem space interesting to the candidate?

## ☑️ Project: Select all

You are building a full-stack application that roughly resembles the Harmonic platform. The application allows a user to interact with companies and lists of companies. There are currently two lists initialized with companies that the user can view. 

A customer has requested the ability to add companies from one list to another. They want the ability to select certain companies from a list to add to a second list, or to “select all” and add every company from a list into the other list. Your job is to take this feature request and implement a thoughtful solution that enables the requested behavior and delights the customer.

Keep in mind there is a throttle placed on the database so that adding all 50k companies from My list to Liked companies may take some time. Your solution should consider this delay and how to maintain a smooth user experience when performing a large action.

### 🎯 Acceptance criteria

1. User should be able to add individual items from `My list` to `Liked companies` 
(and vice versa)
2. User should be able to add the entire set of companies in `My list` to `Liked companies` (and vice versa)
3. UX should reflect In Progress and Completed states when a lengthy action is being performed

### 🧑‍💻 Codebase setup

Below you will find attached a codebase which contains a frontend React application, a backend FastAPI server, and a Postgres database. You can refer to the top level [`README.md`](http://README.md) as well as `frontend/README.md` and `backend/README.md` for instructions to set up the working environment.

## 📫 Deliverables

- A GitHub repo containing your implementation of the project
- A brief, written reflection describing your approach, any assumptions or tradeoffs you made, and any next steps you would take if you were to continue building + maintaining this feature
- A brief (2 mins or less) Loom/video recording of your implementation

## ❓ Frequently asked questions

`What can I modify in the codebase?`
****Feel free to make any changes to the codebase as you see fit. For example, if there is a package or library that would help you implement your solution, feel free to add it to the frontend or backend. We do ask that the general structure of the codebase stays intact (e.g. do not implement an Express backend)

`What tools can I use to help me with this exercise?`
The purpose of the exercise is to emulate the experience of collaborating with your peers at Harmonic, so feel free to use any tools you would use in your day-to-day work. This includes any API references, StackOverflow, ChatGPT/Copilot, etc.

`Why does it take so long for the database to add companies to a list?`

We’ve intentionally throttled the database in [`main.py`](http://main.py) to simulate an extremely slow database. You should assume users will regularly be working with lists containing tens of thousands of companies, and consider the user experience as they perform these operations.