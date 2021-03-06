import { Alert } from 'react-native';
import Toast from 'react-native-root-toast';
import { setPref, loadPrefs, initialPrefs } from './user-prefs';
import { toDict, iterate } from './util';
import { lightTheme, darkTheme } from './constants';
import { getStruct } from '../components/screens/homebrew/details/form';
import t from 'tcomb-validation';
import * as RNIap from 'react-native-iap';
import beasts from '../data/beasts.json';
import products from '../data/iap.json';

const homebrewStruct = getStruct();

export const transientState = {
	isLoading: true,
	iaps: [],
	beasts
};

export const initialState = {
	...initialPrefs,
	...transientState
};

export const syncPrefs = state => setPref('prefs', Object.keys(initialPrefs).reduce((obj, key) => Object.assign(obj, { [key]: state[key] }), {}));

export const actions = (update, states) => {
	const privateActions = {
		async iapConnection(cb) {
			try {
				await RNIap.initConnection();
				await Promise.resolve(cb());
			} catch (e) {
				console.log(e);
			} finally {
				try {
					await RNIap.endConnection();
				} catch (e) {
					console.log(e);
				}
			}
		},
		iapTransaction: cb => privateActions.iapConnection(async() => {
			await RNIap.clearTransaction();
			await Promise.resolve(cb());
			await RNIap.finishTransaction();
		}),
		cleanupFavs: favs => Object.entries(favs)
			.filter(([_, value]) => value)
			.reduce(toDict(([key]) => key, () => true), {}),
		getHomebrewImportMergeList: beasts => new Promise((resolve, reject) => {
			const toImport = [];
			const iterator = iterate(beasts);

			const next = () => {
				const { value, done } = iterator.next();
				if (done) {
					resolve(toImport);
				} else if (!t.validate(value, homebrewStruct).isValid()) {
					reject(new Error('Invalid Data'));
				} else if (states().beasts.find(b => b.name === value.name)) {
					next();
				} else if (states().homebrew.find(b => b.name === value.name)) {
					Alert.alert(
						`${value.name} Already Exists`,
						`There is already an existing homebrew named ${value.name}.`,
						[
							{
								text: 'Cancel',
								style: 'cancel',
								onPress: () => resolve([])
							},
							{
								text: 'Skip',
								onPress: () => next()
							},
							{
								text: 'Replace',
								onPress: () => {
									toImport.push(value);
									next();
								}
							}
						]
					);
				} else {
					toImport.push(value);
					next();
				}
			};
			next();
		})
	};
	const actions = {
		loadPrefs: async() => {
			const prefs = await loadPrefs();
			update({
				...prefs,
				isLoading: false
			});
		},
		loadProducts: () => privateActions.iapConnection(async() => {
			const iaps = await RNIap.getProducts(products);
			update({ iaps });
		}),
		buyProduct: productId => privateActions.iapTransaction(async() => {
			await RNIap.buyProduct(productId);
			Toast.show('Thank you for supporting Druidshape 5e!');
		}),
		setDarkMode: darkMode => {
			update({ darkMode });
			syncPrefs(states());
		},
		getCurrentTheme: () => states().darkMode ? darkTheme : lightTheme,
		getCurrentCharacter: () => states().characters.find(c => c.key === states().selectedCharacter),
		toggleMoon: () => {
			const characters = states().characters;
			const char = characters.find(c => c.key === states().selectedCharacter);
			char.isMoon = !char.isMoon;
			update({ characters });
			syncPrefs(states());
		},
		setLevel: level => {
			const characters = states().characters;
			const char = characters.find(c => c.key === states().selectedCharacter);
			level = parseInt(level);
			char.level = level;
			update({ characters });
			syncPrefs(states());
		},
		toggleFav: name => {
			const characters = states().characters;
			const char = characters.find(c => c.key === states().selectedCharacter);
			const favs = char.favs;
			favs[name] = !favs[name];
			update({ characters });
			syncPrefs(states());
		},
		addHomebrew: beast => {
			const homebrew = [...states().homebrew, beast];
			update({ homebrew });
			syncPrefs(states());
		},
		editHomebrew: (name, beast) => {
			const homebrew = [...states().homebrew.filter(h => h.name !== name), beast];
			const characters = states().characters;
			if (name !== beast.name) {
				characters.forEach(char => {
					const favs = char.favs;
					favs[beast.name] = favs[name];
					favs[name] = false;
					char.favs = privateActions.cleanupFavs(favs);
				});
			}
			update({ homebrew, characters });
			syncPrefs(states());
		},
		deleteHomebrew: name => {
			const homebrew = states().homebrew.filter(h => h.name !== name);
			const characters = states().characters;
			characters.forEach(char => {
				const favs = char.favs;
				favs[name] = false;
				char.favs = privateActions.cleanupFavs(favs);
			});
			update({ homebrew, characters });
			syncPrefs(states());
		},
		importHomebrews: beasts => privateActions
			.getHomebrewImportMergeList(beasts)
			.then(beasts => {
				if (beasts.length > 0) {
					let homebrew = states().homebrew;
					beasts.forEach(b => {
						homebrew = homebrew.filter(h => h.name !== b.name);
						homebrew.push(b);
					});
					update({ homebrew });
					syncPrefs(states());
					Toast.show('Import complete.');
				}
			}),
		getAllBeasts: () => [...states().beasts, ...states().homebrew],
		getBeast: name => actions.getAllBeasts().find(b => b.name === name),
		getFavorites: () => Object.entries(actions.getCurrentCharacter().favs)
			.filter(([_, isFav]) => isFav)
			.map(([key]) => actions.getBeast(key))
			.filter(b => b)
	};
	return actions;
};
