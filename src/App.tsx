import React, { useState } from 'react';
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Link,
  useLocation,
} from 'react-router-dom';
import { ConfigProvider, Layout, Menu, theme } from 'antd';
import {
  TeamOutlined,
  SearchOutlined,
  PullRequestOutlined,
  MenuOutlined,
} from '@ant-design/icons';
import OverviewPage from './pages/OverviewPage';
import GapAnalysisPage from './pages/GapAnalysisPage';
import PRGeneratorPage from './pages/PRGeneratorPage';

const { Header, Content, Sider } = Layout;

const Navigation: React.FC<{
  collapsed: boolean;
  setCollapsed: (v: boolean) => void;
}> = ({ collapsed, setCollapsed }) => {
  const location = useLocation();

  const menuItems = [
    {
      key: '/',
      icon: <TeamOutlined />,
      label: <Link to='/'>Overview</Link>,
    },
    {
      key: '/gaps',
      icon: <SearchOutlined />,
      label: <Link to='/gaps'>Gap Analysis</Link>,
    },
    {
      key: '/update',
      icon: <PullRequestOutlined />,
      label: <Link to='/update'>Update Data</Link>,
    },
  ];

  return (
    <>
      {/* Desktop Sidebar */}
      <Sider
        collapsible
        collapsed={collapsed}
        onCollapse={setCollapsed}
        className='hidden md:block'
        style={{
          background: 'rgba(15, 15, 35, 0.8)',
          backdropFilter: 'blur(12px)',
          borderRight: '1px solid rgba(255, 255, 255, 0.1)',
        }}
        trigger={null}
      >
        <div className='h-16 flex items-center justify-center border-b border-white/10'>
          <span className='text-xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent'>
            {collapsed ? 'RS' : 'RoboSkills'}
          </span>
        </div>
        <Menu
          mode='inline'
          selectedKeys={[location.pathname]}
          items={menuItems}
          style={{
            background: 'transparent',
            borderRight: 'none',
          }}
        />
      </Sider>

      {/* Mobile Header */}
      <Header
        className='md:hidden fixed top-0 left-0 right-0 z-50'
        style={{
          background: 'rgba(15, 15, 35, 0.9)',
          backdropFilter: 'blur(12px)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
          padding: '0 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <span className='text-xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent'>
          RoboSkills
        </span>
        <MenuOutlined
          className='text-white text-xl cursor-pointer'
          onClick={() => setCollapsed(!collapsed)}
        />
      </Header>

      {/* Mobile Menu Overlay */}
      {!collapsed && (
        <div
          className='md:hidden fixed inset-0 z-40 bg-black/50'
          onClick={() => setCollapsed(true)}
        >
          <div
            className='absolute top-16 left-0 right-0 bg-[#0f0f23] border-b border-white/10'
            onClick={(e) => e.stopPropagation()}
          >
            <Menu
              mode='vertical'
              selectedKeys={[location.pathname]}
              items={menuItems}
              style={{ background: 'transparent' }}
              onClick={() => setCollapsed(true)}
            />
          </div>
        </div>
      )}
    </>
  );
};

const AppContent: React.FC = () => {
  const [collapsed, setCollapsed] = useState(true);

  return (
    <Layout className='min-h-screen'>
      <Navigation collapsed={collapsed} setCollapsed={setCollapsed} />
      <Layout>
        <Content
          className='p-4 md:p-8 !pt-20 md:pt-8'
          style={{
            background: 'transparent',
            minHeight: '100vh',
          }}
        >
          <div className='max-w-7xl mx-auto'>
            <Routes>
              <Route path='/' element={<OverviewPage />} />
              <Route path='/gaps' element={<GapAnalysisPage />} />
              <Route path='/update' element={<PRGeneratorPage />} />
            </Routes>
          </div>
        </Content>
      </Layout>

      {/* Background Orbs */}
      <div className='orb orb-1' />
      <div className='orb orb-2' />
      <div className='orb orb-3' />
    </Layout>
  );
};

const App: React.FC = () => {
  return (
    <ConfigProvider
      theme={{
        algorithm: theme.darkAlgorithm,
        token: {
          colorPrimary: '#6366f1',
          colorBgContainer: 'rgba(255, 255, 255, 0.05)',
          colorBgElevated: 'rgba(26, 26, 46, 0.95)',
          colorBorder: 'rgba(255, 255, 255, 0.1)',
          colorText: '#ffffff',
          colorTextSecondary: '#a0a0b0',
          borderRadius: 12,
        },
        components: {
          Menu: {
            itemBg: 'transparent',
            itemSelectedBg: 'rgba(99, 102, 241, 0.2)',
            itemHoverBg: 'rgba(255, 255, 255, 0.05)',
            itemSelectedColor: '#818cf8',
          },
          Card: {
            colorBgContainer: 'rgba(255, 255, 255, 0.05)',
          },
          Table: {
            colorBgContainer: 'transparent',
            headerBg: 'rgba(255, 255, 255, 0.05)',
            rowHoverBg: 'rgba(255, 255, 255, 0.05)',
          },
          Input: {
            colorBgContainer: 'rgba(255, 255, 255, 0.05)',
          },
          Select: {
            colorBgContainer: 'rgba(255, 255, 255, 0.05)',
            colorBgElevated: 'rgba(26, 26, 46, 0.95)',
          },
        },
      }}
    >
      <Router>
        <AppContent />
      </Router>
    </ConfigProvider>
  );
};

export default App;
