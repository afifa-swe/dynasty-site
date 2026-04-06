import { useEffect } from "react";

const Rating = () => {
  useEffect(() => {
    window.location.replace("/tree/index.html");
  }, []);

  return (
    <main className="min-h-screen bg-black text-white flex items-center justify-center px-4">
      <div className="text-center">
        <p className="text-lg">Opening Dynasty Rating…</p>
        <a href="/tree/index.html" className="text-amber-300 underline underline-offset-4">
          Click here if it doesn't open automatically
        </a>
      </div>
    </main>
  );
};

export default Rating;
