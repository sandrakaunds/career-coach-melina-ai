import { useState, useRef, useEffect } from "react";
import "./App.css";


const API_URL =
"https://9b4jhz72ad.execute-api.ap-south-1.amazonaws.com";

const inputStyle = {
  width: "100%",
  boxSizing: "border-box",
  padding: "12px 14px",
  marginBottom: "12px",
  borderRadius: "10px",
  border: "1px solid rgba(80,100,150,0.25)",
  background: "#ffffff",
  color: "#172554",
  fontSize: "15px",
  outline: "none",
  cursor: "text",
  pointerEvents: "auto",
};

const selectStyle = {
  ...inputStyle,
  cursor: "pointer",
};

const planStyle = {
  padding: "16px",
  borderRadius: "12px",
  background: "rgba(245,248,255,0.9)",
  display: "flex",
  flexDirection: "column",
  gap: "6px",
};

const countryOptions = [
  "India",
  "USA",
  "United Kingdom",
  "Canada",
  "Australia",
  "Germany",
  "France",
  "Italy",
  "Spain",
  "United Arab Emirates",
  "Singapore",
  "Other",
];

function App() {
  // =========================================================
  // CONVERSATION
  // =========================================================

  const [conversationActive, setConversationActive] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [userMessage, setUserMessage] = useState("");
  const [melinaResponse, setMelinaResponse] = useState("");

  // =========================================================
  // VISITOR
  // =========================================================

  const [visitorId, setVisitorId] = useState("");
  const [registered, setRegistered] = useState(false);
  const [checkingAccess, setCheckingAccess] = useState(true);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [country, setCountry] = useState("India");

  const [access, setAccess] = useState(null);
  const [registrationError, setRegistrationError] = useState("");
  const [accessError, setAccessError] = useState("");

  // =========================================================
  // EDIT PROFILE
  // =========================================================

  const [editingProfile, setEditingProfile] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [profileSuccess, setProfileSuccess] = useState("");

  // =========================================================
  // REFS
  // =========================================================

  const recognitionRef = useRef(null);
  const conversationActiveRef = useRef(false);
  const voicesRef = useRef([]);
  const isListeningRef = useRef(false);

  // =========================================================
  // LOAD SAVED VISITOR
  // =========================================================

  useEffect(() => {
    const savedVisitorId =
      localStorage.getItem("melinaVisitorId");

    if (!savedVisitorId) {
      setCheckingAccess(false);
      return;
    }

    checkAccess(savedVisitorId);
  }, []);

  // =========================================================
  // LOAD VOICES
  // =========================================================

  useEffect(() => {
    const loadVoices = () => {
      if ("speechSynthesis" in window) {
        voicesRef.current =
          window.speechSynthesis.getVoices();
      }
    };

    loadVoices();

    if ("speechSynthesis" in window) {
      window.speechSynthesis.onvoiceschanged =
        loadVoices;
    }

    return () => {
      if ("speechSynthesis" in window) {
        window.speechSynthesis.onvoiceschanged = null;
      }
    };
  }, []);

  // =========================================================
  // CHECK ACCESS
  // =========================================================

  const checkAccess = async (id) => {
    try {
      const response = await fetch(
        `${API_URL}/api/access`,
        {
          method: "GET",
          headers: {
            "X-Visitor-ID": id,
            "Cache-Control": "no-cache",
          },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        localStorage.removeItem("melinaVisitorId");

        setVisitorId("");
        setRegistered(false);
        setAccess(null);

        return;
      }

      setVisitorId(id);
      setAccess(data);
      setRegistered(true);
      setAccessError("");
    } catch (error) {
      console.error("Access check error:", error);

      setAccessError(
        "Unable to connect to the Melina server."
      );
    } finally {
      setCheckingAccess(false);
    }
  };

  // =========================================================
  // REGISTER
  // =========================================================

  const registerVisitor = async (event) => {
    event.preventDefault();

    setRegistrationError("");
    setAccessError("");

    const cleanName = name.trim();
    const cleanEmail = email.trim();
    const cleanPhone = phone.trim();
    const cleanCountry = country.trim();

    if (!cleanName) {
      setRegistrationError("Please enter your name.");
      return;
    }

    if (!cleanEmail) {
      setRegistrationError("Please enter your email.");
      return;
    }

    if (!cleanPhone) {
      setRegistrationError(
        "Please enter your phone number."
      );
      return;
    }

    if (!cleanCountry) {
      setRegistrationError(
        "Please select your country."
      );
      return;
    }

    try {
      setCheckingAccess(true);

      const response = await fetch(
        `${API_URL}/api/register`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": "no-cache",
          },
          body: JSON.stringify({
            name: cleanName,
            email: cleanEmail,
            phone: cleanPhone,
            country: cleanCountry,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Registration failed."
        );
      }

      localStorage.setItem(
        "melinaVisitorId",
        data.visitorId
      );

      setVisitorId(data.visitorId);
      setRegistered(true);
      setAccess(data);

      setName("");
      setEmail("");
      setPhone("");
      setCountry("India");

      setRegistrationError("");
    } catch (error) {
      console.error("Registration error:", error);

      setRegistrationError(
        error.message ||
          "Could not register. Please try again."
      );
    } finally {
      setCheckingAccess(false);
    }
  };

  // =========================================================
  // START EDITING PROFILE
  // =========================================================

  const startEditingProfile = () => {
    if (!access) {
      return;
    }

    setProfileError("");
    setProfileSuccess("");

    setName(access.name || "");
    setEmail(access.email || "");
    setPhone(access.phone || "");
    setCountry(access.country || "India");

    setEditingProfile(true);
  };

  // =========================================================
  // CANCEL EDITING
  // =========================================================

  const cancelEditingProfile = () => {
    setEditingProfile(false);

    setProfileError("");
    setProfileSuccess("");

    setName("");
    setEmail("");
    setPhone("");
    setCountry("India");
  };

  // =========================================================
  // SAVE PROFILE
  // =========================================================

  const saveProfile = async (event) => {
    event.preventDefault();

    setProfileError("");
    setProfileSuccess("");

    const cleanName = name.trim();
    const cleanEmail = email.trim();
    const cleanPhone = phone.trim();
    const cleanCountry = country.trim();

    if (!cleanName) {
      setProfileError("Please enter your name.");
      return;
    }

    if (!cleanEmail) {
      setProfileError("Please enter your email.");
      return;
    }

    if (!cleanPhone) {
      setProfileError(
        "Please enter your phone number."
      );
      return;
    }

    if (!cleanCountry) {
      setProfileError(
        "Please select your country."
      );
      return;
    }

    try {
      setSavingProfile(true);

      const response = await fetch(
        `${API_URL}/api/profile`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            "X-Visitor-ID": visitorId,
          },
          body: JSON.stringify({
            name: cleanName,
            email: cleanEmail,
            phone: cleanPhone,
            country: cleanCountry,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Could not update your details."
        );
      }

      setAccess(data);
      setEditingProfile(false);

      setName("");
      setEmail("");
      setPhone("");
      setCountry("India");

      setProfileSuccess(
        "Your details have been updated successfully."
      );
    } catch (error) {
      console.error(
        "Profile update error:",
        error
      );

      setProfileError(
        error.message ||
          "Could not update your details."
      );
    } finally {
      setSavingProfile(false);
    }
  };

  // =========================================================
  // FEMALE VOICE
  // =========================================================

  const getFemaleVoice = () => {
    const voices =
      voicesRef.current.length
        ? voicesRef.current
        : window.speechSynthesis.getVoices();

    const englishVoices = voices.filter((voice) =>
      voice.lang
        .toLowerCase()
        .startsWith("en")
    );

    const preferredFemaleNames = [
      "Samantha",
      "Zira",
      "Jenny",
      "Aria",
      "Michelle",
      "Susan",
      "Karen",
      "Google UK English Female",
      "Google US English Female",
      "Microsoft Zira",
      "Microsoft Jenny",
      "Microsoft Aria",
    ];

    for (const preferredName of preferredFemaleNames) {
      const match = englishVoices.find((voice) =>
        voice.name
          .toLowerCase()
          .includes(
            preferredName.toLowerCase()
          )
      );

      if (match) {
        return match;
      }
    }

    const femaleNameMatch =
      englishVoices.find((voice) => {
        const voiceName =
          voice.name.toLowerCase();

        return (
          voiceName.includes("female") ||
          voiceName.includes("zira") ||
          voiceName.includes("jenny") ||
          voiceName.includes("samantha") ||
          voiceName.includes("aria") ||
          voiceName.includes("susan") ||
          voiceName.includes("karen") ||
          voiceName.includes("michelle")
        );
      });

    return (
      femaleNameMatch ||
      englishVoices[0] ||
      voices[0] ||
      null
    );
  };

  // =========================================================
  // SPEAK
  // =========================================================

  const speak = (text) => {
    return new Promise((resolve) => {
      if (!("speechSynthesis" in window)) {
        resolve();
        return;
      }

      window.speechSynthesis.cancel();

      const speech =
        new SpeechSynthesisUtterance(text);

      speech.lang = "en-US";
      speech.rate = 0.92;
      speech.pitch = 1.08;
      speech.volume = 1;

      const femaleVoice = getFemaleVoice();

      if (femaleVoice) {
        speech.voice = femaleVoice;
      }

      speech.onend = resolve;
      speech.onerror = resolve;

      window.speechSynthesis.speak(speech);
    });
  };

  // =========================================================
  // START LISTENING
  // =========================================================

  const startListening = () => {
    if (!conversationActiveRef.current) {
      return;
    }

    if (!registered) {
      return;
    }

    const SpeechRecognition =
      window.SpeechRecognition ||
      window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert(
        "Speech recognition is not supported in this browser. Please use Google Chrome."
      );
      return;
    }

    if (isListeningRef.current) {
      return;
    }

    const recognition =
      new SpeechRecognition();

    recognition.lang = "en-US";
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      isListeningRef.current = true;
      setIsListening(true);
    };

    recognition.onresult = (event) => {
      const transcript =
        event.results[0][0]
          .transcript
          .trim();

      setUserMessage(transcript);

      isListeningRef.current = false;
      setIsListening(false);

      sendMessage(transcript);
    };

    recognition.onerror = (event) => {
      console.log(
        "Speech recognition error:",
        event.error
      );

      isListeningRef.current = false;
      setIsListening(false);

      if (
        event.error === "no-speech" ||
        event.error === "aborted"
      ) {
        if (
          conversationActiveRef.current
        ) {
          setTimeout(() => {
            startListening();
          }, 500);
        }

        return;
      }

      if (event.error === "not-allowed") {
        alert(
          "Please allow microphone access for Melina."
        );

        endConversation();
      }
    };

    recognition.onend = () => {
      isListeningRef.current = false;
      setIsListening(false);
      recognitionRef.current = null;
    };

    recognitionRef.current = recognition;

    try {
      recognition.start();
    } catch (error) {
      console.log(
        "Microphone could not start:",
        error
      );

      isListeningRef.current = false;
      setIsListening(false);
    }
  };

  // =========================================================
  // SEND MESSAGE
  // =========================================================

  const sendMessage = async (message) => {
    if (!message || !visitorId) {
      return;
    }

    setIsThinking(true);
    setMelinaResponse("");
    setAccessError("");

    try {
      const response = await fetch(
        `${API_URL}/api/chat`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Visitor-ID": visitorId,
          },
          body: JSON.stringify({
            message,
          }),
        }
      );

      const data = await response.json();

      // FREE LIMIT
      if (
        response.status === 403 &&
        data.error ===
          "FREE_LIMIT_REACHED"
      ) {
        setIsThinking(false);

        setAccess((previous) => ({
          ...(previous || {}),
          ...data,
          paymentRequired: true,
        }));

        conversationActiveRef.current = false;
        setConversationActive(false);

        if (recognitionRef.current) {
          try {
            recognitionRef.current.stop();
          } catch (error) {
            console.log(error);
          }

          recognitionRef.current = null;
        }

        setMelinaResponse(
          "You've used your 3 free conversations with Melina. Please choose a paid plan to continue."
        );

        return;
      }

      // PAID LIMIT
      if (
        response.status === 403 &&
        data.error ===
          "PAID_LIMIT_REACHED"
      ) {
        setIsThinking(false);

        conversationActiveRef.current = false;
        setConversationActive(false);

        setMelinaResponse(
          "You've used all conversations included in your current plan."
        );

        return;
      }

      // UNAUTHORIZED
      if (response.status === 401) {
        setIsThinking(false);

        conversationActiveRef.current = false;
        setConversationActive(false);

        setRegistered(false);
        setVisitorId("");
        setAccess(null);

        localStorage.removeItem(
          "melinaVisitorId"
        );

        setMelinaResponse(
          "Please register before starting a conversation with Melina."
        );

        return;
      }

      // RATE LIMIT
      if (response.status === 429) {
        setIsThinking(false);

        conversationActiveRef.current = false;
        setConversationActive(false);

        setMelinaResponse(
          data.error ||
            "Gemini's current API quota has been reached. Please try again later."
        );

        return;
      }

      if (!response.ok) {
        throw new Error(
          data.error ||
            `Server returned ${response.status}`
        );
      }

      const reply =
        data.reply ||
        data.response ||
        data.message ||
        data.text ||
        "I'm sorry, I couldn't generate a response.";

      setMelinaResponse(reply);
      setIsThinking(false);

      if (data.usage) {
        setAccess((previous) => ({
          ...(previous || {}),
          ...data.usage,
        }));
      }

      await speak(reply);

      if (
        conversationActiveRef.current
      ) {
        setTimeout(() => {
          startListening();
        }, 500);
      }
    } catch (error) {
      console.error(
        "Melina connection error:",
        error
      );

      setIsThinking(false);

      const errorMessage =
        "I'm having trouble connecting to my career coaching service right now.";

      setMelinaResponse(errorMessage);

      await speak(errorMessage);

      if (
        conversationActiveRef.current
      ) {
        setTimeout(() => {
          startListening();
        }, 700);
      }
    }
  };

  // =========================================================
  // START CONVERSATION
  // =========================================================

  const startConversation = () => {
    if (!registered) {
      setRegistrationError(
        "Please register before starting a conversation."
      );

      return;
    }

    if (access?.paymentRequired) {
      setMelinaResponse(
        "You've used your free conversations. Please choose a paid plan to continue."
      );

      return;
    }

    conversationActiveRef.current = true;
    setConversationActive(true);
    setMelinaResponse("");

    if ("speechSynthesis" in window) {
      voicesRef.current =
        window.speechSynthesis.getVoices();
    }

    setTimeout(() => {
      startListening();
    }, 500);
  };

  // =========================================================
  // END CONVERSATION
  // =========================================================

  const endConversation = () => {
    conversationActiveRef.current = false;

    setConversationActive(false);
    setIsListening(false);
    setIsThinking(false);

    isListeningRef.current = false;

    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (error) {
        console.log(error);
      }

      recognitionRef.current = null;
    }

    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
  };

  // =========================================================
  // SCROLL
  // =========================================================

  const scrollToMelina = () => {
    document
      .getElementById("melina-coach")
      ?.scrollIntoView({
        behavior: "smooth",
      });
  };

  // =========================================================
  // CLEANUP
  // =========================================================

  useEffect(() => {
    return () => {
      conversationActiveRef.current = false;
      isListeningRef.current = false;

      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (error) {
          console.log(error);
        }
      }

      if ("speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  // =========================================================
  // COUNTRY SELECT
  // =========================================================

  const renderCountrySelect = () => {
    const options =
      countryOptions.includes(country)
        ? countryOptions
        : [country, ...countryOptions];

    return (
      <select
        name="country"
        value={country}
        onChange={(event) =>
          setCountry(event.target.value)
        }
        style={selectStyle}
        autoComplete="off"
      >
        {options.map((option) => (
          <option
            value={option}
            key={option}
          >
            {option}
          </option>
        ))}
      </select>
    );
  };

  // =========================================================
  // REGISTRATION FORM
  // =========================================================

  const renderRegistrationForm = () => (
    <div className="form-card">
      <h3>Start Your Melina Journey</h3>

      <p className="form-description">
        Register to receive{" "}
        <strong>3 free conversations</strong>.
      </p>

      <form
        onSubmit={registerVisitor}
        autoComplete="off"
      >
        <input
          type="text"
          name="melina-register-name"
          placeholder="Full Name"
          value={name}
          onChange={(event) =>
            setName(event.target.value)
          }
          autoComplete="off"
          spellCheck="false"
          style={inputStyle}
        />

        <input
          type="email"
          name="melina-register-email"
          placeholder="Email Address"
          value={email}
          onChange={(event) =>
            setEmail(event.target.value)
          }
          autoComplete="off"
          spellCheck="false"
          style={inputStyle}
        />

        <input
          type="tel"
          name="melina-register-phone"
          placeholder="Phone Number"
          value={phone}
          onChange={(event) =>
            setPhone(event.target.value)
          }
          autoComplete="off"
          spellCheck="false"
          style={inputStyle}
        />

        {renderCountrySelect()}

        {registrationError && (
          <p className="form-error">
            {registrationError}
          </p>
        )}

        <button
          type="submit"
          className="voice-btn"
          disabled={checkingAccess}
        >
          {checkingAccess
            ? "Creating Access..."
            : "Create Free Access"}
        </button>
      </form>
    </div>
  );

  // =========================================================
  // PROFILE DETAILS
  // =========================================================

  const renderProfileDetails = () => {
    if (!access) {
      return null;
    }

    if (editingProfile) {
      return (
        <div className="profile-card">
          <h3>Edit Your Details</h3>

          <form
            onSubmit={saveProfile}
            autoComplete="off"
          >
            <input
              type="text"
              name="melina-edit-name"
              placeholder="Full Name"
              value={name}
              onChange={(event) =>
                setName(event.target.value)
              }
              autoComplete="off"
              spellCheck="false"
              style={inputStyle}
            />

            <input
              type="email"
              name="melina-edit-email"
              placeholder="Email Address"
              value={email}
              onChange={(event) =>
                setEmail(event.target.value)
              }
              autoComplete="off"
              spellCheck="false"
              style={inputStyle}
            />

            <input
              type="tel"
              name="melina-edit-phone"
              placeholder="Phone Number"
              value={phone}
              onChange={(event) =>
                setPhone(event.target.value)
              }
              autoComplete="off"
              spellCheck="false"
              style={inputStyle}
            />

            {renderCountrySelect()}

            {profileError && (
              <p className="form-error">
                {profileError}
              </p>
            )}

            <div className="profile-actions">
              <button
                type="submit"
                className="voice-btn"
                disabled={savingProfile}
              >
                {savingProfile
                  ? "Saving..."
                  : "Save Changes"}
              </button>

              <button
                type="button"
                className="cancel-btn"
                onClick={cancelEditingProfile}
                disabled={savingProfile}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      );
    }

    return (
      <div className="profile-card">
        <h3>Your Details</h3>

        <div className="profile-details">
          <div>
            <strong>Full Name:</strong>{" "}
            {access.name}
          </div>

          <div>
            <strong>Email:</strong>{" "}
            {access.email}
          </div>

          <div>
            <strong>Phone:</strong>{" "}
            {access.phone}
          </div>

          <div>
            <strong>Country:</strong>{" "}
            {access.country}
          </div>
        </div>

        {profileSuccess && (
          <p className="profile-success">
            {profileSuccess}
          </p>
        )}

        <button
          type="button"
          className="voice-btn"
          onClick={startEditingProfile}
        >
          ✏️ Edit Details
        </button>
      </div>
    );
  };

  // =========================================================
  // PAYMENT PLANS
  // =========================================================

  const renderPaymentPlans = () => {
    const isIndia = access?.country
      ?.toLowerCase()
      .includes("india");

    return (
      <div className="payment-card">
        <h3>🔒 Continue With Melina</h3>

        <p>
          Your 3 free conversations have been used.
        </p>

        <div className="payment-grid">
          <div style={planStyle}>
            <strong>🇮🇳 India</strong>

            <span>
              ₹499 → 25 conversations
            </span>

            {isIndia && (
              <button
                className="voice-btn"
                onClick={() =>
                  setMelinaResponse(
                    "The ₹499 payment option will be connected here next."
                  )
                }
              >
                Continue — ₹499
              </button>
            )}
          </div>

          <div style={planStyle}>
            <strong>
              🌎 USA / International
            </strong>

            <span>
              $12 → 70 conversations
            </span>

            {!isIndia && (
              <button
                className="voice-btn"
                onClick={() =>
                  setMelinaResponse(
                    "The $12 payment option will be connected here next."
                  )
                }
              >
                Continue — $12
              </button>
            )}
          </div>
        </div>

        <p className="payment-note">
          Secure payment will be connected in the next step.
        </p>
      </div>
    );
  };

  // =========================================================
  // PAGE
  // =========================================================

  return (
    <div className="app">

      {/* NAVBAR */}

      <nav className="navbar">
        <div className="logo">
          <img
            src="/melina-icon.png"
            alt="Melina AI"
            className="logo-image"
          />

          <span>Melina AI</span>
        </div>

        <div className="nav-links">
          <a href="#home">Home</a>

          <a href="#careers">
            Careers
          </a>

          <a href="#how-it-works">
            How It Works
          </a>

          <a href="#about">
            About
          </a>

          <button
            className="login-btn"
            onClick={scrollToMelina}
          >
            Talk to Melina
          </button>
        </div>
      </nav>

      <main>

        {/* HERO */}

        <section
          className="hero"
          id="home"
        >
          <div className="hero-content">

            <p className="welcome">
              WELCOME TO CAREER COACH MELINA AI
            </p>

            <h1>
              Your Personal
              <span>
                AI Career Coach
              </span>
            </h1>

            <p className="hero-text">
              Discover the right career path,
              understand the skills you need,
              identify your skill gaps, and build
              a personalized roadmap with Melina AI.
            </p>

            <div className="hero-buttons">

              <button
                className="primary-btn"
                onClick={scrollToMelina}
              >
                🎙️ Talk to Melina
              </button>

              <a
                href="#careers"
                className="secondary-btn"
              >
                Explore Careers
              </a>

            </div>
          </div>

          {/* MELINA CARD */}

          <div
            className="melina-card"
            id="melina-coach"
          >

            <div className="melina-avatar">
              <img
                src="/melina-icon.png"
                alt="Melina AI Career Coach"
              />
            </div>

            <h2>
              Hi, I'm Melina! 👋
            </h2>

            <p>
              I'm your AI career coach.
              I'll help you explore career
              options, understand the skills
              you need, create your learning
              roadmap, and prepare for your
              career journey.
            </p>

            <div className="ai-status">
              <span></span>

              {conversationActive
                ? "Melina is Online"
                : "AI Career Coach"}
            </div>

            <div className="voice-coach">

              <h3>
                🎙️ Voice Conversation
              </h3>

              <p className="voice-description">
                Have a natural conversation with
                Melina about your career.
              </p>

              {/* CHECKING */}

              {checkingAccess && (
                <div className="checking-access">
                  Checking your Melina access...
                </div>
              )}

              {/* REGISTRATION */}

              {!checkingAccess &&
                !registered &&
                renderRegistrationForm()}

              {/* REGISTERED */}

              {!checkingAccess &&
                registered && (
                  <>
                    {renderProfileDetails()}

                    {access && (
                      <div className="usage-status">

                        {access.paidAccess ? (
                          <>
                            Paid access:{" "}
                            <strong>
                              {Math.max(
                                access.paidLimit -
                                  access.paidUsed,
                                0
                              )}
                            </strong>{" "}
                            conversations remaining
                          </>
                        ) : (
                          <>
                            Free conversations:{" "}
                            <strong>
                              {Math.max(
                                access.freeRemaining ??
                                  0,
                                0
                              )}
                            </strong>{" "}
                            of 3 remaining
                          </>
                        )}

                      </div>
                    )}

                    {!conversationActive ? (
                      <button
                        className="voice-btn"
                        onClick={
                          startConversation
                        }
                        disabled={
                          access?.paymentRequired ||
                          editingProfile
                        }
                      >
                        🎤 Start Conversation
                      </button>
                    ) : (
                      <button
                        className="voice-btn end-btn"
                        onClick={
                          endConversation
                        }
                      >
                        🔴 End Conversation
                      </button>
                    )}

                    {access?.paymentRequired &&
                      renderPaymentPlans()}

                    {conversationActive && (
                      <div className="online-status">

                        <span className="online-dot"></span>

                        <span>
                          {isListening
                            ? "Melina is listening..."
                            : isThinking
                            ? "Melina is thinking..."
                            : "Melina is speaking..."}
                        </span>

                      </div>
                    )}

                    {userMessage && (
                      <div className="conversation-box user-box">

                        <div className="conversation-label">
                          👤 You
                        </div>

                        <p>
                          {userMessage}
                        </p>

                      </div>
                    )}

                    {isThinking && (
                      <div className="thinking-box">

                        <div className="thinking-dots">
                          <span></span>
                          <span></span>
                          <span></span>
                        </div>

                        <p>
                          Melina is thinking...
                        </p>

                      </div>
                    )}

                    {melinaResponse && (
                      <div className="conversation-box melina-box">

                        <div className="conversation-label">
                          🤖 Melina
                        </div>

                        <p>
                          {melinaResponse}
                        </p>

                        <button
                          className="replay-btn"
                          onClick={() =>
                            speak(
                              melinaResponse
                            )
                          }
                        >
                          🔊 Replay
                        </button>

                      </div>
                    )}

                    {accessError && (
                      <p className="access-error">
                        {accessError}
                      </p>
                    )}
                  </>
                )}

            </div>
          </div>
        </section>

        {/* CAREERS */}

        <section
          className="careers"
          id="careers"
        >
          <div className="section-heading">

            <p>
              EXPLORE YOUR OPTIONS
            </p>

            <h2>
              Career Paths
            </h2>

            <span>
              Choose a career path and let
              Melina guide your journey.
            </span>

          </div>

          <div className="career-grid">

            {[
              [
                "📊",
                "Business Analyst",
                "Learn requirements gathering, business processes, documentation, stakeholder communication and process improvement.",
              ],
              [
                "📈",
                "Data Analyst",
                "Learn Excel, SQL, Power BI, Python, statistics, data cleaning and data visualization.",
              ],
              [
                "💻",
                "Full Stack Developer",
                "Build modern web applications using frontend, backend, databases and APIs.",
              ],
              [
                "⛓️",
                "Blockchain Developer",
                "Learn blockchain concepts, smart contracts, decentralized applications and Web3 technologies.",
              ],
              [
                "🚀",
                "SEO & AI Digital Marketing",
                "Learn SEO, digital marketing, AI automation, content strategy and lead generation.",
              ],
              [
                "👥",
                "IT Recruiter",
                "Learn technical sourcing, candidate screening, ATS/CRM systems and IT recruitment.",
              ],
              [
                "🎓",
                "Technical Trainer",
                "Learn how to teach technical skills, conduct practical sessions and support learners.",
              ],
            ].map(
              ([icon, title, description]) => (
                <div
                  className="career-card"
                  key={title}
                >
                  <div className="career-icon">
                    {icon}
                  </div>

                  <h3>{title}</h3>

                  <p>
                    {description}
                  </p>

                  <button
                    onClick={scrollToMelina}
                  >
                    Explore Career →
                  </button>
                </div>
              )
            )}

          </div>
        </section>

        {/* HOW IT WORKS */}

        <section
          className="how-it-works"
          id="how-it-works"
        >
          <div className="section-heading">

            <p>
              YOUR CAREER JOURNEY
            </p>

            <h2>
              How Melina Helps You
            </h2>

            <span>
              Melina will guide you from your
              current skills to your career goal.
            </span>

          </div>

          <div className="steps-grid">

            {[
              [
                "01",
                "Tell Melina Your Goal",
                "Tell Melina what career you want to pursue and share your background.",
              ],
              [
                "02",
                "Analyze Your Skills",
                "Melina identifies the skills you already have and the areas you need to improve.",
              ],
              [
                "03",
                "Build Your Roadmap",
                "Receive a personalized learning roadmap with skills, tools, courses and projects.",
              ],
              [
                "04",
                "Prepare for Your Career",
                "Practice interviews, improve your resume and track your career progress.",
              ],
            ].map(
              ([number, title, description]) => (
                <div
                  className="step-card"
                  key={number}
                >
                  <div className="step-number">
                    {number}
                  </div>

                  <h3>
                    {title}
                  </h3>

                  <p>
                    {description}
                  </p>
                </div>
              )
            )}

          </div>
        </section>

        {/* ABOUT */}

        <section
          className="about"
          id="about"
        >
          <p>
            THE MELINA EXPERIENCE
          </p>

          <h2>
            Don't just choose a career.
            <span>Build one.</span>
          </h2>

          <p>
            Melina AI is designed to help
            people understand their career
            options, identify skill gaps,
            discover learning opportunities
            and create a personalized career
            development journey.
          </p>

          <button
            className="primary-btn"
            onClick={scrollToMelina}
          >
            Start With Melina
          </button>
        </section>

      </main>

      {/* FOOTER */}

      <footer>

        <div className="footer-logo">

          <img
            src="/melina-icon.png"
            alt="Melina AI"
          />

          <span>
            Career Coach Melina AI
          </span>

        </div>

        <p>
          © 2026 Career Coach Melina AI.
          All rights reserved.
          Created By Sandra Swamy Kaunds (+91 7507144567) 
        </p>

      </footer>

    </div>
  );
}

export default App;




