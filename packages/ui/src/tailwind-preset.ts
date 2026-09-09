const preset = {
  theme: {
    extend: {
      colors: {
        matos: {
          bg: "#0b0c0e",
          elev: "#12141a",
          panel: "#161922",
          border: "#2a2e3a",
          soft: "#1e222d",
          text: "#f2f3f5",
          muted: "#8b93a7",
          muted2: "#5c657a",
          citron: "#D6F31F",
          "citron-hover": "#E8FF5A",
          "citron-pressed": "#B8D110",
          danger: "#f07178",
        },
      },
      fontFamily: {
        sans: [
          "Segoe UI",
          "Helvetica Neue",
          "ui-sans-serif",
          "system-ui",
          "sans-serif",
        ],
        mono: ["ui-monospace", "SF Mono", "Menlo", "Consolas", "monospace"],
      },
      boxShadow: {
        citron: "0 0 24px rgba(214, 243, 31, 0.35)",
      },
    },
  },
};

export default preset;
