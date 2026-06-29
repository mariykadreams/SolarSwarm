import { Button, Navbar, NavbarBrand, NavbarCollapse, NavbarLink, NavbarToggle } from "flowbite-react";
import { useState } from "react";



const Header = () => {
  const [status, setStatus] = useState("Grid Up")


    return (
        <>
            <Navbar fluid rounded>
      <NavbarBrand href="/">
        <img src="/bulb.png" className="mr-3 h-6 sm:h-9" alt="SolarSwarm" />
        <span className="self-center whitespace-nowrap text-xl font-semibold dark:text-white">SolarSwarm</span>
      </NavbarBrand>
      <div className="flex md:order-2">
        <Button outline color={status == "Grid Up" ? "green": "red"}>{status}</Button>
        <NavbarToggle />
      </div>
    </Navbar>
        </>
    );
};

export default Header;