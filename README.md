# ziggo-horizon
The Dutch television provider Ziggo issues a so called 'Mediabox XL'. At the time of writing, this is either an SMT-C7400 or an SMT-C7401. Both devices don't have a discrete power on and power off command making them 'dumb devices' for the Neeo Remote.

By writing a custom driver for the SMT-C7400 and SMT-C7401 based on work done by other developers, the SMT-C7400 and SMT-C7401 can be made 'smart'.

**Reading material found/used:**
 - [Horizon Control](https://github.com/kuijp/horizoncontrol) (Python API wrapper)
 - [Einder](https://github.com/OrangeTux/einder) (Java API wrapper)
 - [tv.horizon.ziggo](https://github.com/jordenc/tv.horizon.ziggo) (Homey API wrapper)
 - [HorizonRemote](https://github.com/rogro82/HorizonRemote) (Android API wrapper)
 - [horizon](https://github.com/openhab/openhab1-addons/tree/master/bundles/binding/org.openhab.binding.horizon) (OpenHAB binding)
 - [Ziggo HorizonBox support](https://www.domoticz.com/forum/viewtopic.php?f=31&t=10518) (Domoticz Forum)

Basically i will be combining the best of the above in creating the Neeo driver.

___Note: this is a work in progress and i'll keep this repo updated with the steps i have done to get it working for me.___

## Preparing your Ziggo Mediabox XL
Besides a digital recorder, the Ziggo Mediabox XL is also a fully featured media player. If you only use the Ziggo Mediabox XL for television and have a separate modem for the internet, then you need to follow step 1 and step 2. Do you use your Ziggo Mediabox XL for both television and internet on one device? Then you can get start at step step 2. _In order for this driver to work, you would need to make sure both steps are completed._

### Step 1. Connect to your home network (Dutch instructions).
Your Ziggo Mediabox XL should be connected to your home network. I would advise to connect with a network cable, but connection using WiFi follows almost the same steps outlined below. It is pretty self-explanatory.
1. Press **Menu** on the Ziggo Mediabox XL remote.
2. Select **Opties**.
3. Select **Mijn Thuisnetwerk** and press **OK**.
4. Select **Instellen Thuisnetwerk** and press **OK**.
5. Select **Op het modem** and press **OK**.
6. Connect the Ziggo Mediabox XL with a network cable to your modem.
7. Select **Netwerkkabel** and press OK.
8. The Ziggo Mediabox XL has to reboot now.

_Assuming you have connected your Ziggo Mediabox XL  to your home network, figure out the IP of the box and preferably use DHCP on your router to give it a static DHCP address._
1. Open a web-browser, type in the IP address and hit enter.
2. A login page should appear (if not, tripple check **Mijn Thuisnetwerk** settings and try again).
3. Login with **admin**/**admin** (yes.. very secure indeed).
4. Click on **Basis**, followed by **Thuisnetwerk**. You can verify here that your horizon is connected to your home network. ![Lan1](https://github.com/Webunity/ziggo-horizon/raw/master/Assets/lan1.png)
5. Then click **Local Area Network** where you can see your IP, the main MAC address of the Ziggo Mediabox XL and the DHCP-poolsize that the Ziggo Mediabox XL has claimed from your router (19 IP addresses) ![Lan2](https://github.com/Webunity/ziggo-horizon/raw/master/Assets/lan2.png)

_In my particular case, i was interested in the last IP address, 192.168.1.143, since this is hosting the media server when the box is powered on. You can figure this out by looking at the MAC address of your Mediabox XL (blurred in above pics) and see which other IP has almost the same MAC address in your router reservation table. In my case, only the last 2 digits of the MAC address where different._

### Step 2. Make sure you are sharing your media library (Dutch instructions).
Now that your box is connected to your home network, you need to enable the embedded XBMC client inside the Ziggo Mediabox XL. This is an essential part for the driver, since XBMC is only running when your box is on, thus we can check to see if XBMC is reachable, meaning your box is on.
1. Press **Menu** on the Ziggo Mediabox XL remote.
2. Select **Opties**
3. Select **Mijn Thuisnetwerk** and press **OK**.
4. Select **Instellen Thuisnetwerk** and press **OK**.
5. Select **Ja** and press **OK**
6. Accept the **Algemene voorwaarden**

The Ziggo Mediabox XL is now going to index your personal media, but only if it is exposed on your home network via DLNA. This may take a while depending on the amount of files. If you don't have any DLNA servers that is ok, we just need this XBMC server to 'be online'. p.s. the media library can be found through Mijn Media in the main menu of your Ziggo Mediabox XL.

# Tip: Turn off the WiFi access points
By default, the Ziggo Mediabox XL exposes 2 WiFi networks, one on 5 GHz and one on 2.4 GHz. Since i have my own router with 4 WiFi networks already (private/guest, both on 2.4 GHz and 5 GHz) AND i don't want other people to piggy back on my bandwidth, i have chosen to disable the WiFi networks on the Ziggo Mediabox XL.

According to a different site, you should start with disabling the 5 GHz network. So first click **Draadloos**, followed by **5 GHz** and then **Radio**. Change the dropdown to **Uitgeschakeld** and press **Opslaan**.
![WiFi1](https://github.com/Webunity/ziggo-horizon/raw/master/Assets/wifi1.png)

Then follow the same steps for the 2.4 GHz network, like shown below.
![WiFi2](https://github.com/Webunity/ziggo-horizon/raw/master/Assets/wifi2.png)

That should be it!