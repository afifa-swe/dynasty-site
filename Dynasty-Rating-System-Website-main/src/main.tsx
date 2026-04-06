
  import { createRoot } from "react-dom/client";
  import App from "./App.tsx";
  import "./tailwind.css";
console.log('API base', import.meta.env.VITE_API_BASE);

  createRoot(document.getElementById("root")!).render(<App />);
  
