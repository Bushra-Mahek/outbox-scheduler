
import Sidebar from "./Sidebar";

const MainLayout = ({ children }) => {
  return (
    <div className="app">
      <Sidebar />

      <main className="main">
        {children}
      </main>
    </div>
  );
};

export default MainLayout;
