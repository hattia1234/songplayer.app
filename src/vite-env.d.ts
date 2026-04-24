/// <reference types="vite/client" />

// Allow importing CSS files
declare module '*.css' {
  const content: string;
  export default content;
}

// Allow importing other assets if needed
declare module '*.png' 
declare module '*.jpg' 
declare module '*.jpeg' 
declare module '*.svg' 
declare module '*.gif' 