<div align="center">
  <img src="public/logo.svg" alt="RoboSkills Logo" width="120" />
  <h1>RoboSkills</h1>
  <h3>Robotic Skill Visualization & Analysis Platform</h3>
  
  <p>
    An interactive, data-driven dashboard for visualizing robotic capabilities, <br />
    analyzing skill gaps, and managing expertise distribution.
  </p>

  <br />
  <img src="public/og-image.png" alt="RoboSkills Preview" width="100%" />
  <br />

  <p>
    <a href="https://whats2000.github.io/RoboSkills/">Live Demo</a> •
    <a href="#features">Features</a> •
    <a href="#tech-stack">Tech Stack</a> •
    <a href="#getting-started">Getting Started</a> •
    <a href="#license">License</a>
  </p>
</div>

---

## 🚀 Overview

**RoboSkills** is a cutting-edge web application designed to bridge the gap between complex robotic data and actionable insights. By leveraging advanced visualization techniques—including forced-directed graphs and Venn diagrams—it provides a clear map of skill dependencies, overlaps, and critical gaps in robotic development.

## 📋 Using This Template

This repository is designed as a **template** for creating your own customized skill visualization website. Here's how to get started:

### 1. Create Your Repository from This Template

**On GitHub:**

1. Click the **"Use this template"** button at the top of this repository
2. Choose a name for your new repository (e.g., `my-team-skills`)
3. Select whether you want it to be public or private
4. Click **"Create repository from template"**

**Or using GitHub CLI:**

```bash
gh repo create my-team-skills --template whats2000/RoboSkills --public
cd my-team-skills
```

### 2. Customize Your Data

Update the configuration files to match your team's information:

**a) Homepage Configuration** (`public/data/homeConfig.json`)

- Update your organization name, description, and logo
- Customize the hero section text and imagery
- Add your team's social links and contact information

**b) Skills Data** (`public/data/skillsData.json`)

- Add your team members with their expertise levels
- Define the skills and competencies relevant to your domain
- Set up skill categories and their relationships

### 3. Customize Branding

**Visual Identity:**

- Replace `public/logo.svg` with your own logo
- Update `public/og-image.png` for social media sharing
- Modify the color scheme in `src/index.css` and Tailwind configuration

**Site Metadata:**

- Update the title and description in `index.html`
- Modify the `vite.config.ts` for your deployment base path if needed.
  If your repository name is `my-team-skills`, set:
  ```ts
    base: '/my-team-skills/',
  ```

### 4. Deploy Your Site

**GitHub Pages (Recommended):**

1. Go to your repository **Settings** → **Pages**
2. Set source to **GitHub Actions**
3. Push your changes - the site will automatically deploy
4. Your site will be available at `https://your-username.github.io/your-repo-name`

**Other Platforms:**

- **Vercel**: Connect your repository and deploy with zero configuration
- **Netlify**: Import your project and deploy automatically
- **Custom Server**: Run `npm run build` and serve the `dist` folder

### 5. Keep Your Template Updated

To sync with upstream template improvements:

```bash
git remote add template https://github.com/whats2000/RoboSkills.git
git fetch template
git merge template/main --allow-unrelated-histories
```

## ✨ Key Features

- **📊 Interactive Skill Chart**
  - Visualize complex relationships with dynamic D3.js Venn diagrams.
  - Explore skill clusters using interactive force-directed graphs.
- **📉 Gap Analysis Engine**
  - Identify missing capabilities with precision.
  - Visualize expertise distribution (`Novice` to `Expert`) across different domains.

- **🎨 Modern User Interface**
  - Built with **Ant Design** and **Tailwind CSS** for a sleek, glassmorphism-inspired aesthetic.
  - Fully responsive layout ensuring a seamless experience on all devices.

## 🛠️ Tech Stack

Built with modern, high-performance technologies:

| Category       | Technology                                                                                                    | Description                         |
| :------------- | :------------------------------------------------------------------------------------------------------------ | :---------------------------------- |
| **Framework**  | ![React](https://img.shields.io/badge/React-20232A?style=flat&logo=react&logoColor=61DAFB)                    | Frontend library for building UIs   |
| **Language**   | ![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=flat&logo=typescript&logoColor=white)      | Typed superset of JavaScript        |
| **Build Tool** | ![Vite](https://img.shields.io/badge/Vite-646CFF?style=flat&logo=vite&logoColor=white)                        | Next Generation Frontend Tooling    |
| **Styling**    | ![TailwindCSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=flat&logo=tailwind-css&logoColor=white) | Utility-first CSS framework         |
| **Components** | ![Ant Design](https://img.shields.io/badge/Ant_Design-0170FE?style=flat&logo=ant-design&logoColor=white)      | Enterprise-class UI design language |
| **Data Viz**   | ![D3.js](https://img.shields.io/badge/D3.js-F9A03C?style=flat&logo=d3.js&logoColor=white)                     | Dynamic data visualization library  |

## 🏁 Getting Started

Follow these steps to set up the project locally.

### Prerequisites

- **Node.js** (v18+ recommended)
- **npm** or **yarn**

### Installation

1.  **Clone the repository**

    ```bash
    # Please replace the URL with your own repository if you forked or created from template
    git clone https://github.com/whats2000/RoboSkills.git
    cd robotic-skill-visualize
    ```

2.  **Install dependencies**

    ```bash
    npm install
    # or
    yarn install
    ```

3.  **Start the development server**

    ```bash
    npm run dev
    # or
    yarn dev
    ```

4.  **Explore**
    Open `http://localhost:5173` in your browser to view the app.

### ✨ Visual Data Editor

We provide a built-in visual tool to help you generate the necessary JSON Structure for adding members or skills!

1.  Start the application (`npm run dev`)
2.  Navigate to the **Update Data** page (e.g., `http://localhost:5173/update`)
3.  Use the form to add members, skills, and generate the JSON snippet
4.  Copy the generated JSON into your `public/data/skillsData.json` file

## 📦 Building for Production

To generate a production-ready build:

```bash
npm run build
```

The output will be optimized and placed in the `dist` directory.

## 📄 License

This project is licensed under the terms of the [LICENSE](./LICENSE) file.

## 👏 Third Party Licenses

This project incorporates code from external libraries. We thank the authors for their work:

- **[d3-venn](https://github.com/christophe-g/d3-venn)** by Christophe Geiser (BSD 3-Clause License)
- **[venn.js](https://github.com/benfred/venn.js)** by Ben Frederickson (MIT License)
- **[spa-github-pages](https://github.com/rafgraph/spa-github-pages)** by Rafael Pedicini (MIT License)
