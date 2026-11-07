
import Sidebar from "./Sidebar";

const MainLayout = ({ children, activePage }) => {
  return (
    <div className="app">
      <Sidebar activePage={activePage} />

      <main className="main">
        {children}
      </main>
    </div>
  );
};

export default MainLayout;
