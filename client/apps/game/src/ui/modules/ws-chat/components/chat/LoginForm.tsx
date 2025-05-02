import Button from "@/ui/elements/button";
import React, { useState } from "react";

interface LoginFormProps {
  onLogin: (username: string) => void;
}

const LoginForm: React.FC<LoginFormProps> = ({ onLogin }) => {
  const [username, setUsername] = useState<string>("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) return;
    onLogin(username);
  };

  return (
    <div className="w-full flex flex-col items-center justify-center rounded-lg to-orange-900  p-4 animate-gradient-bg bg-[length:400%_400%] z-1 pointer-events-auto panel-wood dark:bg-dark-wood panel-wood-corners ">
      <div className="p-6 md:p-8 w-full max-w-md mx-auto">
        <h1 className="text-2xl md:text-3xl mb-6 text-center">Enter The Tavern</h1>
        <form onSubmit={handleSubmit} className="flex flex-col items-center">
          <input
            type="text"
            placeholder="Who are you?"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            className="w-full p-4 mb-6 bg-brown/10 rounded border-gold/5 border focus:outline-none text-gold placeholder-gold/70 shadow-inner"
          />
          <Button variant={"default"} type="submit">
            Join
          </Button>
        </form>
      </div>
    </div>
  );
};

export default LoginForm;
