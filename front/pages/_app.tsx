import "@/styles/globals.css";
import type { AppProps } from "next/app";

export default function App({ Component, pageProps }: AppProps) {
  return (
    <div className="relative">
      <a
        target="_blank"
        className="text-xs font-thin absolute -top-6 left-2"
        href="https://github.com/Nicoalz"
      >
        Github: Nicoalz
      </a>
      <Component {...pageProps} />
    </div>
  );
}
