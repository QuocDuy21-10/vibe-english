import { AppDataProvider } from "@/routes/AppDataProvider";
import { AppRouter } from "@/routes/AppRouter";

export default function App() {
  return (
    <AppDataProvider>
      <AppRouter />
    </AppDataProvider>
  );
}

