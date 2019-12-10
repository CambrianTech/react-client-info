
import {useCallback, useEffect, useRef, useState} from 'react'
import * as React from "react";

export enum BrowserType {
    Other,
    LegacyIE = 'Legacy IE',
    IE11 = "IE 11",
    Edge = "Edge",
    Chrome = "Chrome",
    Firefox = "Firefox",
    Safari = "Safari",
}

export enum OSType {
    Other,
    Linux = "Linux",
    Windows = "Windows",
    Darwin = "Darwin",
}

export type BrowserProperties = {
    userAgent?:string

    browser?: BrowserType
    operatingSystem?: OSType

    isMobile?: boolean
    hasTouchpad?: boolean
    isPortrait?: boolean
    hasGestureSupport?: boolean
}

type WebClientProperties = {
    onClientStateChanged?:(client:BrowserProperties)=>void
}

export function WebClientInfo(props:WebClientProperties) {

    const [browserProperties, _setBrowserProperties] = useState<BrowserProperties>({});

    let _isMounted = useRef(false);
    const setBrowserProperties = useCallback((props:BrowserProperties) => {
        if (!_isMounted.current) return
        let clone = Object.assign({}, props);
        _setBrowserProperties(clone)
    }, []);

    useEffect(() => {
        _isMounted.current = true;

        return () => {
            _isMounted.current = false
        }
    }, []);

    const calcIsPortrait = useCallback(() => {
        const mql = window.matchMedia("(orientation: portrait)");
        return mql.matches
    }, []);

    const setUserAgentProperties = useCallback((props:BrowserProperties) => {
        const ua = window.navigator.userAgent; //Check the userAgent property of the window.navigator object

        if (ua.indexOf('MSIE ') !== -1) {
            props.browser = BrowserType.LegacyIE
        } else if (ua.indexOf('Trident/') !== -1) {
            props.browser = BrowserType.IE11
        } else if (ua.indexOf('Edge/') !== -1) {
            props.browser = BrowserType.Edge
        } else if (ua.indexOf('Firefox/') !== -1) {
            props.browser = BrowserType.Firefox
        } else if (ua.indexOf('Chrome/') !== -1 || ua.indexOf('CriOS/') !== -1) {
            props.browser = BrowserType.Chrome
        } else if (ua.indexOf('Safari/') !== -1) {
            props.browser = BrowserType.Safari
        } else {
            props.browser = BrowserType.Other
        }

        props.isMobile = ua.indexOf('Mobile') !== -1 || ua.indexOf('iOS') !== -1 || ua.indexOf('Android') !== -1 || ('ontouchstart' in window);
        if (props.isMobile) {
            console.log("Device is mobile.")
        }

        if (ua.indexOf('Mac OS') !== -1) {
            props.operatingSystem = OSType.Darwin
        } else if (ua.indexOf('Windows') !== -1) {
            props.operatingSystem = OSType.Windows
        } else if (ua.indexOf('Linux') !== -1) {
            props.operatingSystem = OSType.Linux
        } else if (ua.indexOf('Android') !== -1) {
            props.operatingSystem = OSType.Other;
            props.isMobile = true
        } else if (ua.indexOf('iOS') !== -1) {
            props.operatingSystem = OSType.Other;
            props.isMobile = true
        } else {
            props.operatingSystem = OSType.Other
        }

        if (props.isMobile || props.operatingSystem === OSType.Darwin) {
            props.hasTouchpad = true;
            props.hasGestureSupport = props.browser === BrowserType.Safari
        }

        props.userAgent = ua;

        props.isPortrait = calcIsPortrait();

        //console.log(Client);
    }, [calcIsPortrait]);

    const _orientationInterval = useRef<number>(0);
    const _orientationIntervalChecks = useRef<number>(0);

    const _handleOrientation = useCallback(() => {
        const newValue = calcIsPortrait();
        if (_orientationInterval.current && _orientationIntervalChecks.current > 30) {
            window.clearInterval(_orientationInterval.current);
            _orientationInterval.current = 0
        } else {
            _orientationIntervalChecks.current ++
        }

        if (newValue !== browserProperties.isPortrait) {
            let props = browserProperties;
            props.isPortrait = calcIsPortrait();
            setBrowserProperties(props)
        }
    }, [browserProperties, calcIsPortrait, setBrowserProperties]);

    const handleOrientation = useCallback(() => {
        if (_orientationInterval.current === 0) {
            _orientationIntervalChecks.current = 0;
            _orientationInterval.current = window.setInterval(_handleOrientation, 200)
        }
    }, [_handleOrientation]);

    const handleResize = useCallback(() => {
        setUserAgentProperties(browserProperties);
        setBrowserProperties(browserProperties);
    }, [setUserAgentProperties, browserProperties, setBrowserProperties]);

    let isMouseCounts: Array<number> = [];

    const detectMouseType = useCallback((e:WheelEvent) => {
        if (!browserProperties.hasTouchpad) return;

        if (e.ctrlKey) {
            //pinch zoom OSX and surface, ignore
            return
        }

        let isMouse = e.deltaX === 0 && !Number.isInteger(e.deltaY);

        isMouseCounts.push(isMouse ? 1 : 0);
        if (isMouseCounts.length > 5) isMouseCounts.shift();

        let sum = isMouseCounts.reduce(function(a, b) { return a + b; });

        if (sum > 3 && e.type === "wheel") {
            console.log("Touchpad disabled");
            //detected a mouse not a touchpad, maybe a mouse plugged into a mac
            document.documentElement.style.setProperty("--scrollbar-display", "block");
            document.removeEventListener('wheel', detectMouseType);

            let props = browserProperties;
            props.hasTouchpad = false;
            props.hasGestureSupport = false;
            setBrowserProperties(props)
        }
    }, [browserProperties, isMouseCounts, setBrowserProperties]);

    const disableTouchZoom = useCallback((event:TouchEvent) => {
        if (event.touches.length > 1) {
            event.preventDefault()
        }
    }, []);

    const disableTouchpadZoom = useCallback((event:WheelEvent) => {
        if (event.ctrlKey) {
            event.preventDefault()
        }
    }, []);

    const disableGenericEvent = useCallback((event:Event) => {
        event.preventDefault()
    }, []);

    //add and keep track of listeners, because they need to be replaced
    const listeners = useRef<{[listener: string]: any}>({});

    const addExclusiveEventListener = useCallback((element:EventTarget, type: string, listener: any) => {
        const existing = listeners.current[type];
        if (existing) {
            element.removeEventListener(type, existing, false)
        }
        element.addEventListener(type, listener, false);
        listeners.current[type] = listener
    }, []);

    const removeAllEventListeners = useCallback((element:EventTarget) => {
        for (let type in listeners.current) {
            const listener = listeners.current[type];
            element.removeEventListener(type, listener)
        }
    }, []);

    const setupEvents = useCallback(() => {
        //disable default zooming on mobile
        const firstElementChild = document.body.firstElementChild as HTMLElement;
        if (firstElementChild) {

            if (browserProperties.isMobile) {
                addExclusiveEventListener(firstElementChild, 'touchstart', disableTouchZoom);
                addExclusiveEventListener(firstElementChild, 'touchmove', disableTouchZoom);
            }

            if (browserProperties.browser === BrowserType.Safari) {
                browserProperties.hasGestureSupport = true;

                addExclusiveEventListener(firstElementChild, 'gesturestart', disableGenericEvent);
                addExclusiveEventListener(firstElementChild, 'gesturechange', disableGenericEvent);
                addExclusiveEventListener(firstElementChild, 'gestureend', disableGenericEvent);
            }
            else {
                addExclusiveEventListener(firstElementChild, 'wheel', disableTouchpadZoom);
            }
        }

        //add events for detecting things
        if (browserProperties.hasTouchpad && !browserProperties.isMobile) {
            addExclusiveEventListener(window, 'wheel', detectMouseType);
        }

        addExclusiveEventListener(window, "resize", handleResize);
        addExclusiveEventListener(window, "orientationchange", handleOrientation);

        return () => {
            const firstElementChild = document.body.firstElementChild as HTMLElement;
            if (firstElementChild) {
                removeAllEventListeners(firstElementChild)
            }
            removeAllEventListeners(window)
        }
    }, [addExclusiveEventListener, removeAllEventListeners, disableTouchZoom, disableGenericEvent,
        disableTouchpadZoom, detectMouseType, handleResize, handleOrientation,
        browserProperties.browser, browserProperties.hasGestureSupport, browserProperties.hasTouchpad, browserProperties.isMobile]);

    useEffect(() => {
        if (_isMounted.current && props.onClientStateChanged) {
            props.onClientStateChanged(browserProperties)
        }
    }, [browserProperties, props]);

    const initialize = useCallback(() => {
        setUserAgentProperties(browserProperties);
        setupEvents()
        handleOrientation()
        setBrowserProperties(browserProperties)
    }, [])

    const initializeRef = useRef(initialize);
    useEffect(() => { initializeRef.current = initialize; }, [initialize]);

    useEffect(() => {
        if (initializeRef.current) {
            initializeRef.current()
        }
    }, []);

    return null
}