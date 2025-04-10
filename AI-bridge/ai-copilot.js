import { AIToggle } from "./ai-toggle.js";

/**
 * Submits the given prompt text to the Copilot playground form.
 * 
 * take note that this function must be serializable to pass to executeScript. Don't call subfunction etc.
 * 
 * @param {string} prompt - The prompt text to submit.
 */
const submit = (prompt) => {

    const promptElem = document.querySelector('textarea#userInput');
    if (!promptElem) {
        console.warn("COPILOT: 'textarea#userInput' not found!");
        return;
    }

    promptElem.value = prompt;
    
    
    const setFocus = ( onElem, timeout = 500 ) => {
        onElem.dispatchEvent(new Event('input', { 'bubbles': true }));
        return new Promise( (resolve, reject) => {
            setTimeout( () => {
                onElem.focus();
                if( document.activeElement === onElem  )
                    resolve(true)
                else
                    //reject( )
                    resolve(false)
            }, timeout )
        })
    }
    
    const pressEnter = ( onElem ) => {
        // Create a new KeyboardEvent
        const enterEvent = new KeyboardEvent('keydown', {
            bubbles: true, // Make sure the event bubbles up through the DOM
            cancelable: true, // Allow it to be canceled
            key: 'Enter', // Specify the key to be 'Enter'
            code: 'Enter', // Specify the code to be 'Enter' for newer browsers
            which: 13 // The keyCode for Enter key (legacy property)
        });
        
        // Dispatch the event on the textarea element
        onElem.dispatchEvent(enterEvent);
    
    }
    
    const retrySetFocusUntilSuccess = ( onElem, retry ) => {
        console.debug( 'focus attempt remaining ', retry );
        if( retry === 0 ) {
            return Promise.reject("prompt refuse the focus")
        }
    
        return setFocus(onElem)
            .then( () => Promise.resolve() )
            .catch( () => retrySetFocusUntilSuccess( onElem, retry - 1 ) );
    }
    
    retrySetFocusUntilSuccess( promptElem, 3)
        .then( () =>  pressEnter( promptElem ) )
        .catch( (e) =>  console.warn(e.message) );
    
}

class CopilotComponent extends AIToggle {

    constructor() {
        super();
        this.setAttribute("queryTabUrl", "*://copilot.microsoft.com/*" ); 
        this.setAttribute("createTabUrl", "https://copilot.microsoft.com/" ); 
        this.submitClosure = submit
    }

}

customElements.define('ai-copilot', CopilotComponent);
