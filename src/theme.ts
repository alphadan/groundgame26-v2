import {
  createTheme,
  PaletteColor,
  PaletteColorOptions,
  Theme,
} from "@mui/material/styles";
import { red, grey, blueGrey } from "@mui/material/colors";

declare module "@mui/material/styles" {
  interface Palette {
    voter: {
      hardR: string;
      weakR: string;
      swing: string;
      weakD: string;
      hardD: string;
    };
    kpi: {
      onTrack: string;
      ahead: string;
      behind: string;
      target: string;
      neutral: string;
    };
    gold: PaletteColor; // For the gold.main, gold.contrastText structure
  }

  interface PaletteOptions {
    voter?: {
      hardR?: string;
      weakR?: string;
      swing?: string;
      weakD?: string;
      hardD?: string;
    };
    kpi?: {
      onTrack?: string;
      ahead?: string;
      behind?: string;
      target?: string;
      neutral?: string;
    };
    gold?: PaletteColorOptions;
  }
}

// GOP-inspired palette
const primaryRed = "#B22234";
const navy = "#0A3161";
const lightBackground = "#FAFAFA";
const darkBackground = "#121212";
const accentGold = "#B7935F";

const baseTheme = {
  palette: {
    primary: {
      main: primaryRed,
      light: "#E54B5F",
      dark: "#8B1A1A",
      contrastText: "#FFFFFF",
    },
    secondary: {
      main: navy,
      light: "#0D4A8A",
      dark: "#07254A",
      contrastText: "#FFFFFF",
    },
    error: {
      main: red[700],
    },
    gold: {
      main: "#B7935F",
      contrastText: "#FFFFFF",
    },
    voter: {
      hardR: "#B22234",
      weakR: "#E57373",
      swing: "#AB47BC",
      weakD: "#90CAF9",
      hardD: "#1976D2",
    },
    kpi: {
      onTrack: "#43A047",
      ahead: "#66BB6A",
      behind: "#FF8A65",
      target: accentGold,
      neutral: grey[500],
    },
  },
  typography: {
    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
    h4: {
      fontWeight: 700,
    },
    h5: {
      fontWeight: 600,
    },
    h6: {
      fontWeight: 600,
    },
    button: {
      textTransform: "none" as const,
      fontWeight: 600,
    },
  },
  shape: {
    borderRadius: 8,
  },
  spacing: 8,
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
        },
        containedPrimary: {
          backgroundColor: primaryRed,
          "&:hover": {
            backgroundColor: "#8B1A1A",
          },
        },
        containedSecondary: {
          backgroundColor: navy,
          "&:hover": {
            backgroundColor: "#07254A",
          },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          borderRadius: 12,
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 12,
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 16,
        },
      },
      defaultProps: {
        size: "small" as const,
      },
    },
    MuiAlert: {
      styleOverrides: {
        root: ({ theme }: { theme: Theme }) => ({
          borderRadius: 12,
          fontWeight: 500,
        }),
        outlinedError: ({ theme }: { theme: Theme }) => ({
          color:
            theme.palette.mode === "light"
              ? navy
              : theme.palette.primary.contrastText,
          backgroundColor:
            theme.palette.mode === "light"
              ? "#fff"
              : theme.palette.background.paper,
          borderColor: primaryRed,
          "& .MuiAlert-icon": {
            color: primaryRed,
          },
        }),
      },
    },
  },
};

const lightTheme = createTheme({
  ...baseTheme,
  palette: {
    ...baseTheme.palette,
    mode: "light",
    background: {
      default: lightBackground,
      paper: "#FFFFFF",
    },
    text: {
      primary: grey[900],
      secondary: grey[700],
    },
  },
});

const darkTheme = createTheme({
  ...baseTheme,
  palette: {
    ...baseTheme.palette,
    mode: "dark",
    primary: {
      main: primaryRed,
      light: "#E54B5F",
      dark: "#8B1A1A",
      contrastText: "#FFFFFF",
    },
    background: {
      default: darkBackground,
      paper: "#1E1E1E",
    },
    text: {
      primary: "#FFFFFF",
      secondary: grey[300],
    },
    divider: grey[800],
  },
});

export { lightTheme, darkTheme };
