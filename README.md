# Neeo-driver-ziggo-horizon
The Dutch television provider Ziggo issues a so called 'Mediabox XL'. At the time of writing, this is either an SMT-C7400 or an SMT-C7401. Both devices don't have a discrete power on and power off command making them 'dumb devices' for the Neeo Remote.

By writing a custom driver for the SMT-C7400 and SMT-C7401 based on work done by other developers, the SMT-C7400 and SMT-C7401 can be made 'smart'.

__NOTE: Starting with Neeo version 0.51.3 you can (only) use the Neeo CLI to run this driver. Instructions [can be found here](https://github.com/Webunity/neeo-driver-ziggo-horizon/wiki/Running-this-driver)__

## Reading material found/used:
 - [Horizon Control](https://github.com/kuijp/horizoncontrol) (Java API wrapper)
 - [Einder](https://github.com/OrangeTux/einder) (Python API wrapper)
 - [tv.horizon.ziggo](https://github.com/jordenc/tv.horizon.ziggo) (Homey API wrapper)
 - [HorizonRemote](https://github.com/rogro82/HorizonRemote) (Android API wrapper)
 - [horizon](https://github.com/openhab/openhab1-addons/tree/master/bundles/binding/org.openhab.binding.horizon) (OpenHAB binding)
 - [Ziggo HorizonBox support](https://www.domoticz.com/forum/viewtopic.php?f=31&t=10518) (Domoticz Forum)

Basically i will be combining the best of the above in creating the Neeo driver.

## The documentation is on the wiki
Please refer to the [Wiki page](https://github.com/Webunity/neeo-driver-ziggo-horizon/wiki/) for more information how you should setup your mediabox and configure this driver.
