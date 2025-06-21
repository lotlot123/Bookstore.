import React, { useEffect, useState, createContext, useContext } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  FlatList,
  ScrollView,
  StyleSheet,
  TextInput,
  Alert, 
} from 'react-native';

// Ito po ang SQLite na ginagamit namin para magkaroon ng local na database sa phone
import * as SQLite from 'expo-sqlite';

// Gumamit din po ako ng navigation para makalipat-lipat ng screen sa app
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

// Dito po ako gumawa ng navigation stack — ito yung para mag-navigate between pages
const Stack = createNativeStackNavigator();
let db = null; // Nilagay ko lang muna to para may reference sa database

const AuthContext = createContext(null);

// Dito po yung mga books na nilagay ko
const books = [
  {
    id: 1,
    title: 'El Filibusterismo',
    author: 'José Protasio Rizal',
    date: 'September 18, 1891',
    price: 89,
    image: require('./assets/elfili.jpg'), // Ginamit ko po is local image
  },
  {
    id: 2,
    title: 'Noli Me Tangere',
    author: 'José Protasio Rizal',
    date: ' March 21, 1887',
    price: 98,
    image: require('./assets/noli.jpg'),
  },
  {
    id: 3,
    title: 'Florante at Laura',
    author: 'Francisco Balagtas',
    date: '1838',
    price: 143,
    image: require('./assets/flor.jpg'),
  },
  {
    id: 4,
    title: 'Ibong Adarna',
    author: 'Jose Dela Cruz',
    date: '1865',
    price: 149,
    image: require('./assets/ibon.jpg'),
  },
];

// Dito po ako gumawa ng function para i-setup yung database tables (cart at users).
const setupDatabase = async () => {
  db = await SQLite.openDatabaseAsync('cart.db');
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS cart (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT,
      quantity INTEGER DEFAULT 1
    );
  `);
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE,
      password TEXT
    );
  `);
};

// Ito po yung screen kung saan magla-log in ang mga existing users.
function LoginScreen({ navigation }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const { signIn } = useContext(AuthContext);

  // Function para i-handle ang pag-log in kapag pinindot ang 'Log In' button.
  // Ito ang nagba-validate ng credentials at nagma-manage ng authentication state.
  const handleLogin = async () => {
    if (!db) return;

    try {
      const user = await db.getFirstAsync('SELECT * FROM users WHERE username = ?;', [username]);

      // Chine-check kung may user na nahanap at kung same po ang password.
      if (user && user.password === password) {
        signIn(username);
      } else {
        Alert.alert('Login Failed', 'Invalid username or password.'); 
      }
    } catch (error) {
      console.error('Login error:', error);
      Alert.alert('Login Error', 'An error occurred during login.');
    }
  };

  return (
    <View style={authStyles.container}>
      <Text style={authStyles.title}>Welcome Back!</Text>
      <TextInput
        style={authStyles.input}
        placeholder="Username"
        value={username}
        onChangeText={setUsername}
        autoCapitalize="none" // Para hindi automatic na maging capital ang unang letra ng username
      />
      <TextInput
        style={authStyles.input}
        placeholder="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry 
      />
      <TouchableOpacity style={authStyles.button} onPress={handleLogin}>
        <Text style={authStyles.buttonText}>Log In</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={() => navigation.navigate('Register')}>
        <Text style={authStyles.linkText}>Don't have an account? Register here.</Text>
      </TouchableOpacity>
    </View>
  );
}

// Ito po yung screen kung saan gagawa ng bagong account ang mga users.
function RegisterScreen({ navigation }) {
  const [username, setUsername] = useState(''); // Para sa username input
  const [password, setPassword] = useState(''); // Para sa password input

  // Function para i-handle ang pag-register kapag pinindot ang Register button.
  // Ito ang nagva-validate ng user input at nagse-save ng bagong account sa database.
  const handleRegister = async () => {
    if (!db) return; 
    if (!username || !password) {
      Alert.alert('Registration Failed', 'Please enter both username and password.');
      return;
    }

    try {
      // I-insert ang bagong user sa users table.
      await db.runAsync('INSERT INTO users (username, password) VALUES (?, ?);', [username, password]);
      Alert.alert('Registration Successful', 'Your account has been created. You can now log in!');
      navigation.goBack();
    } catch (error) {
      // Chine-check kung may error dahil sa unique constraint.
      if (error.message.includes('UNIQUE constraint failed')) {
        Alert.alert('Registration Failed', 'Username already exists. Please choose a different one.');
      } else {
        console.error('Registration error:', error);
        Alert.alert('Registration Error', 'An error occurred during registration.');
      }
    }
  };

  return (
    // Pangunahing container para sa Register screen, ginagamit ang authStyles.container
    <View style={authStyles.container}>
      <Text style={authStyles.title}>Create Account</Text>
      <TextInput
        style={authStyles.input}
        placeholder="Username"
        value={username}
        onChangeText={setUsername}
        autoCapitalize="none"
      />
      <TextInput
        style={authStyles.input}
        placeholder="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />
      <TouchableOpacity style={authStyles.button} onPress={handleRegister}>
        <Text style={authStyles.buttonText}>Register</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={() => navigation.goBack()}>
        <Text style={authStyles.linkText}>Already have an account? Log In.</Text>
      </TouchableOpacity>
    </View>
  );
}

// Ito na po 'yung unang screen na makikita — listahan ng mga libro.
// Ang screen na ito ay makikita lang kung ang user ay naka-login na.
function BookListScreen({ navigation }) {
  const [cartCount, setCartCount] = useState(0); // Eto po is para makita kung ilang books na nasa cart
  const { signOut } = useContext(AuthContext); // Kinukuha ang signOut function mula sa AuthContext

  // Ginamit ko po ang useEffect para i-setup agad ang database at i-fetch ang cart count kapag unang bukas
  useEffect(() => {
    // Listener para sa 'focus' event ng screen, para mag-update ang cart count tuwing babalik sa screen na ito.
    const unsubscribe = navigation.addListener('focus', () => {
      fetchCartCount();
    });


    setupDatabase().then(fetchCartCount);

    return unsubscribe;
  }, [navigation]);

  // Dito po nadadagdagan ang cart kapag nag-click ng "Add to Cart"
  const addToCart = async (title) => {
    if (!db) return;
    // Chine-check kung existing na ang item sa cart
    const existingItems = await db.getAllAsync('SELECT * FROM cart WHERE title = ?;', [title]);
    if (existingItems.length > 0) {
      // Kung existing na, dadagdagan lang ang quantity
      const item = existingItems[0];
      const newQuantity = item.quantity + 1;
      await db.runAsync('UPDATE cart SET quantity = ? WHERE id = ?;', [newQuantity, item.id]);
    } else {
      // Kung bagong item, i-insert sa cart na may quantity na 1
      await db.runAsync('INSERT INTO cart (title, quantity) VALUES (?, 1);', [title]);
    }
    await fetchCartCount(); // I-update ang bilang ng nasa cart sa header
  };

  // Dito ko kinukuha kung ilan ang laman ng cart.
  const fetchCartCount = async () => {
    if (!db) return;
    const results = await db.getAllAsync('SELECT SUM(quantity) as totalQuantity FROM cart;');
    const total = results[0].totalQuantity ?? 0;
    setCartCount(total);
  };

  // Ito po yung design at data para sa bawat book item sa FlatList.
  const renderBook = ({ item }) => (
    <View style={styles.card}>
      <Image source={typeof item.image === 'string' ? { uri: item.image } : item.image} style={styles.image} />
      <Text style={styles.title}>{item.title}</Text>
      <Text style={styles.details}>by {item.author}</Text>
      <Text style={styles.details}>{item.date}</Text>
      <Text style={styles.price}>₱{item.price}</Text>
      <TouchableOpacity onPress={() => addToCart(item.title)} style={styles.button}>
        <Text style={styles.buttonText}>Add to Cart</Text>
      </TouchableOpacity>
    </View>
  );

  // Ito po yung pinaka-layout ng Book List page.
  return (
    <View style={{ flex: 1, backgroundColor: '#f0f4f7' }}>
      {/* Header section na may title, cart icon, at logout button */}
      <View style={styles.header}>
        <Text style={styles.headerText}>WessBooks</Text>
        <View style={styles.headerRight}>
          {/* Button para pumunta sa Cart screen */}
          <TouchableOpacity onPress={() => navigation.navigate('Cart')}>
            <Text style={styles.cartIcon}>🛒 {cartCount}</Text>
          </TouchableOpacity>
          {/* Button para mag-log out, tinatawag ang signOut function mula sa context */}
          <TouchableOpacity onPress={signOut} style={styles.logoutButton}>
            <Text style={styles.logoutButtonText}>Log Out</Text>
          </TouchableOpacity>
        </View>
      </View>
      {/* FlatList na magpapakita ng mga libro */}
      <FlatList
        data={books} 
        renderItem={renderBook}
        keyExtractor={(item) => item.id.toString()}
        numColumns={2}
        contentContainerStyle={styles.container} 
      />
    </View>
  );
}

// Ito na po yung Cart screen kung saan makikita yung mga napili na items.
function CartScreen({ navigation }) {
  const [cartItems, setCartItems] = useState([]); // State para sa mga items sa cart


  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      fetchCartItems();
    });
    return unsubscribe;
  }, [navigation]);

  // Eto po is taga-kuha ng lahat ng items sa cart mula sa database.
  const fetchCartItems = async () => {
    if (!db) return; 
    const results = await db.getAllAsync('SELECT * FROM cart;');
    setCartItems(results);
  };

  // Function para sa delete ng item mula sa cart.
  const deleteCartItem = async (id) => {
    await db.runAsync('DELETE FROM cart WHERE id = ?;', [id]);
    await fetchCartItems();
  };

  // Function para dagdagan or bawasan ang quantity ng isang item.
  const updateQuantity = async (id, newQuantity) => {
    if (newQuantity <= 0) {
      await deleteCartItem(id);
    } else {
      await db.runAsync('UPDATE cart SET quantity = ? WHERE id = ?;', [newQuantity, id]);
    }
    await fetchCartItems();
  };

  // Function para i-handle ang checkout process.
  const handleCheckout = async () => {
    if (cartItems.length === 0) {
      Alert.alert('Checkout', 'Your cart is empty!');
      return;
    }

    await db.runAsync('DELETE FROM cart;'); // Tina-tanggal lahat ng items sa cart (para sa checkout)
    setCartItems([]);
    Alert.alert('Checkout', 'Thank you for your purchase!'); 
    navigation.goBack();
  };

  // Dito ko po pinapakita lahat ng nasa cart.
  return (
    <View style={styles.modalContent}>
      <Text style={styles.modalTitle}>🛒 Cart Items</Text>
      <ScrollView>
        {cartItems.length === 0 ? (
          // Kung walang laman ang cart, ipapakita ito.
          <Text style={styles.emptyText}>Your cart is empty.</Text>
        ) : (
          // Kung may laman, i-mamap ang bawat item para i-display.
          cartItems.map((item) => (
            <View key={item.id} style={styles.cartRow}>
              <Text style={styles.cartItem}>
                • {item.title} (x{item.quantity})
              </Text>
              <View style={styles.cartActions}>
                {/* Button para bawasan ang quantity */}
                <TouchableOpacity onPress={() => updateQuantity(item.id, item.quantity - 1)} style={[styles.qtyButton, { backgroundColor: '#e74c3c' }]}>
                  <Text style={styles.qtyButtonText}>-</Text>
                </TouchableOpacity>
                <Text style={styles.quantityText}>{item.quantity}</Text>
                {/* Button para dagdagan ang quantity */}
                <TouchableOpacity onPress={() => updateQuantity(item.id, item.quantity + 1)} style={[styles.qtyButton, { backgroundColor: '#3498db' }]}>
                  <Text style={styles.qtyButtonText}>+</Text>
                </TouchableOpacity>
                {/* Button para i-delete ang item */}
                <TouchableOpacity onPress={() => deleteCartItem(item.id)} style={[styles.deleteButton, { marginLeft: 10 }]}>
                  <Text style={styles.deleteButtonText}>Delete</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      {/* Checkout button */}
      <TouchableOpacity onPress={handleCheckout} style={styles.checkoutButton}>
        <Text style={styles.checkoutButtonText}>Checkout</Text>
      </TouchableOpacity>
    </View>
  );
}

// Ito po ang pinaka-root ng app, dito ko nilagay yung lahat ng screen at ang authentication logic.
export default function App() {
  // Ito ang magsasabi kung naka-login ba ang user.
  const [userToken, setUserToken] = useState(null);
  // State para magpakita ng loading screen habang ini-initialize ang app.
  const [isLoading, setIsLoading] = useState(true);

  // Ito ang unang code na tumatakbo kapag binuksan ang app, nagse-setup ng database.
  useEffect(() => {
    const bootstrapAsync = async () => {
      await setupDatabase();
      setIsLoading(false);
    };

    bootstrapAsync();
  }, []); 

  // authContext: React.useMemo ang ginagamit para hindi na mare-render ang context value
  // maliban kung magbago ang dependencies. Nagbibigay ito ng signIn at signOut functions sa buong app.
  const authContext = React.useMemo(
    () => ({
      // signIn function: Tinatawag kapag matagumpay ang login.
      signIn: async (username) => {
        // Sa totoong app, dito mo sine-save ang authentication token sa AsyncStorage.
        setUserToken(username); // Ginagamit lang ang username bilang simpleng token para sa demo
      },
      // signOut function: Tinatawag kapag nag-log out ang user.
      signOut: () => {
        // Sa totoong app, dito mo nire-remove ang token mula sa AsyncStorage.
        setUserToken(null); // Ini-set sa null ang userToken para maging logged out
      },
      // signUp function: Ito ay para sa registration, pero sa example na ito,
      // direkta nang ini-handle ito sa RegisterScreen.
      signUp: async (username, password) => {
        // Para sa simplicity, direkta na lang itong magla-login pagkatapos ng successful registration
        setUserToken(username);
      },
    }),
    [] // Walang dependencies, kaya isang beses lang ito gagawin
  );

  // Loading Screen: Ipapakita ito habang naglo-load ang app
  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <Text>Loading app...</Text>
      </View>
    );
  }

  return (
    // AuthContext.Provider: Nilalabas ang authContext sa lahat ng children components.
    // Mahalaga ito para ma-access ng iba't ibang screens ang authentication state.
    <AuthContext.Provider value={authContext}>
      <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          {userToken == null ? (
            <>
              <Stack.Screen name="Login" component={LoginScreen} />
              <Stack.Screen name="Register" component={RegisterScreen} />
            </>
          ) : (
            <>
              <Stack.Screen name="Books" component={BookListScreen} />
              <Stack.Screen name="Cart" component={CartScreen} options={{ headerShown: true }} />
            </>
          )}
        </Stack.Navigator>
      </NavigationContainer>
    </AuthContext.Provider>
  );
}

// Ito naman po is para sa mga designs and positions ng BookList at Cart screens.
const styles = StyleSheet.create({
  container: {
    padding: 20,
    alignItems: 'center',
  },
  card: {
    backgroundColor: '#fff',
    width: 170,
    margin: 10,
    borderRadius: 15,
    padding: 10,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  image: {
    width: 100,
    height: 140,
    resizeMode: 'cover',
    marginBottom: 10,
    borderRadius: 8,
  },
  title: {
    fontWeight: 'bold',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 4,
  },
  details: {
    fontSize: 11,
    textAlign: 'center',
    color: '#555',
    marginBottom: 2,
  },
  price: {
    fontSize: 13,
    fontWeight: '500',
    color: '#2d3436',
    marginVertical: 6,
  },
  button: {
    backgroundColor: '#3498db',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    marginTop: 4,
  },
  buttonText: {
    color: '#fff',
  },
  header: {
    paddingTop: 35,
    paddingBottom: 15,
    paddingHorizontal: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
  },
  headerText: {
    fontWeight: 'bold',
    fontSize: 20,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cartIcon: {
    fontSize: 24,
    marginRight: 15,
  },
  logoutButton: {
    backgroundColor: '#e74c3c',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 20,
  },
  logoutButtonText: {
    color: '#fff',
    fontSize: 12,
  },
  modalContent: {
    flex: 1,
    marginHorizontal: 25,
    marginTop: 40,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  cartRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 6,
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: '#fff',
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  cartItem: {
    fontSize: 16,
    flexShrink: 1,
  },
  cartActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  qtyButton: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4,
  },
  qtyButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 18,
  },
  quantityText: {
    marginHorizontal: 8,
    fontSize: 16,
  },
  deleteButton: {
    backgroundColor: '#e74c3c',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 5,
  },
  deleteButtonText: {
    color: 'white',
    fontSize: 12,
  },
  checkoutButton: {
    marginTop: 25,
    backgroundColor: '#2ecc71',
    paddingVertical: 12,
    borderRadius: 25,
    alignItems: 'center',
  },
  checkoutButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 50,
    fontSize: 16,
    color: '#999',
  },
});

// Ito naman po ang mga styles para sa Login at Register screens.
const authStyles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#f0f4f7',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 30,
    color: '#333',
  },
  input: {
    width: '90%',
    padding: 15,
    backgroundColor: '#fff',
    borderRadius: 10,
    marginBottom: 15,
    fontSize: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  button: {
    width: '90%',
    padding: 15,
    backgroundColor: '#3498db',
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 10,
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  linkText: {
    marginTop: 20,
    color: '#3498db',
    fontSize: 15,
  },
});
