import localFont from "next/font/local";

export const poppins = localFont({
  src: [
    { path: "./fonts/poppins/Poppins-Light.ttf", weight: "300", style: "normal" },
    { path: "./fonts/poppins/Poppins-Regular.ttf", weight: "400", style: "normal" },
    { path: "./fonts/poppins/Poppins-Medium.ttf", weight: "500", style: "normal" },
    { path: "./fonts/poppins/Poppins-SemiBold.ttf", weight: "600", style: "normal" },
    { path: "./fonts/poppins/Poppins-Bold.ttf", weight: "700", style: "normal" },
  ],
  variable: "--font-poppins", display: "swap", preload: false, fallback: ["Arial", "sans-serif"],
});
export const abhaya = localFont({ src: "./fonts/abhaya-libre/AbhayaLibre-Bold.ttf", weight: "700", style: "normal", variable: "--font-abhaya", display: "swap", fallback: ["Georgia", "serif"] });
