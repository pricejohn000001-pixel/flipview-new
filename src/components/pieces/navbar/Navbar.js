import React, { useContext } from 'react';
import { NavLink, useHistory } from 'react-router-dom';
import styles from './navbar.module.css';
import { FileText, FilePlus } from 'lucide-react';
import { FiLogOut } from 'react-icons/fi';
import ghcImage from '../../../assets/logo/hc_logo.png';
import { AuthContext } from '../../../utils/connectors/authContext';

const Navbar = () => {
  const history = useHistory();
  const { logout, role } = useContext(AuthContext);

  const handleLogout = () => {
    logout(); // Clear auth state
    history.replace('/'); // Replace history to prevent back navigation
  };

  return (
    <nav className={styles.navbar}>
      <div className={styles.logoContainer}>
        <img src={ghcImage} alt="Gauhati High Court Logo" className={styles.logo} />
        <span className={styles.siteName}>Gauhati High Court</span>
      </div>

      <div className={styles.navLinks}>
        {role === 1 && (
          <NavLink
            to="/form"
            className={styles.navLink}
            activeClassName={styles.activeNavLink}
          >
            <FilePlus className={styles.icon} />
            Form
          </NavLink>
        )}

        {role === 2 && (
          <NavLink
            to="/view-report"
            className={styles.navLink}
            activeClassName={styles.activeNavLink}
          >
            <FileText className={styles.icon} />
            View Report
          </NavLink>
        )}

        <button
          onClick={handleLogout}
          className={styles.navLink}
        >
          <FiLogOut className={styles.icon} />
          Logout
        </button>
      </div>
    </nav>
  );
};

export default Navbar;
